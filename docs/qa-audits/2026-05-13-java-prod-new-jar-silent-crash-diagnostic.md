# Java prod new-jar silent crash — diagnostic & fix (2026-05-13)

## TL;DR

**Root cause:** PR #493 (T-R5-2) added the bogus property
`spring.servlet.multipart.file-encoding=UTF-8` to all four
`application*.properties` files. That key is not a member of Spring Boot's
`MultipartProperties` class, which is annotated
`@ConfigurationProperties(prefix="spring.servlet.multipart", ignoreUnknownFields=false)`.
The binder rejects the unknown key and the application fails to start.

**Why it looked silent:** for the `pg-prod` profile, `logback-spring.xml`
routes the root logger ONLY to `ASYNC_INFO` / `ASYNC_ERROR` file appenders.
There is no `CONSOLE` appender in the prod profile, so the Spring Boot
`LoggingFailureAnalysisReporter` ERROR message landed in
`logs/cretas-backend-error.log` instead of stdout — making the systemd
exit-code=1 look like a mystery crash.

**Fix:** delete the four lines that set the bogus property. The other
properties added in the same PR (`server.servlet.encoding.*` — charset /
enabled / force) are valid and stay. The original mojibake-recovery
intent is already covered by `NormalizedFilenameMultipartFile` at
`SmartBIUploadController:156` and `:232`.

## Symptom snapshot

```
$ systemctl status cretas-backend-green
● cretas-backend-green.service — failed (Result: exit-code) since 10:33:37 CST
  Main PID: 4074425 (code=exited, status=1/FAILURE)
  Service RestartSec=15s expired, scheduling restart.
  Scheduled restart job, restart counter is at 3.
  Start request repeated too quickly.
  Failed with result 'exit-code'.
```

Direct shell launch (no systemd) reproduces the same exit-code=1 inside ~5s
with only the Spring Boot banner emitted on stdout. No `hs_err_pid*.log`,
no `dmesg` OOM kill, no JVM crash file. Disk 78% / inodes 8%.
`-Xmx` increase from 1280m → 2560m had no effect — not memory-related.

## How the root cause was found

### Step 1: Force logback's own status output

Enabled logback's internal status listener:

```bash
java -Dlogback.statusListenerClass=ch.qos.logback.core.status.OnConsoleStatusListener \
     -Dlogging.level.root=DEBUG \
     -jar aims-0.0.1-SNAPSHOT.jar --spring.profiles.active=pg-prod ...
```

That revealed logback couldn't find `logback.xml` (because the config is
`logback-spring.xml`, loaded later by Spring's `LoggingApplicationListener`)
and fell back to `BasicConfigurator`. Banner prints. Then nothing. JVM
exits status=1.

### Step 2: Run the OLD (working) jar with the same flags

Same stdout pattern — banner only, no Spring logs. But the OLD jar stays
alive when killed by `timeout 30`. Conclusion: **the Spring logger is
configured to write to a file, not stdout, for the prod profile.** Both
jars produce only the banner on stdout — silence isn't a bug, it's by
design via `logback-spring.xml`.

### Step 3: Locate prod log file

`logback-spring.xml` ⇒ `${LOG_PATH:-logs}/cretas-backend.log` and
`-error.log`. The error log contained the smoking gun:

```
APPLICATION FAILED TO START
Description:
  Binding to target [Bindable@... MultipartProperties,
    @ConfigurationProperties(ignoreInvalidFields=false,
      ignoreUnknownFields=false, prefix="spring.servlet.multipart") ...]
  failed:
    Property: spring.servlet.multipart.file-encoding
    Value: "UTF-8"
    Origin: application-pg-prod.properties — 118:40
    Reason: The elements [spring.servlet.multipart.file-encoding]
            were left unbound.
```

systemd had logged that error three times (10:35:03, 10:35:33, 10:36:07)
before giving up on the burst.

### Step 4: Confirm Spring Boot has no such property

Spring Boot 3.2.12 `MultipartProperties` fields: `enabled`, `location`,
`max-file-size`, `max-request-size`, `file-size-threshold`,
`resolve-lazily`. No `file-encoding`. The class is annotated
`@ConfigurationProperties(prefix="spring.servlet.multipart", ignoreUnknownFields=false)`,
which is exactly why this typo aborts startup instead of being silently
ignored as most unknown keys are.

## Why CI missed it

No existing `@SpringBootTest` in `backend/java/cretas-api/src/test/java`
activates the `pg-prod` profile (verified by
`grep -rln "pg-prod\|ActiveProfiles.*prod"` → zero matches). Test profile
binds against in-memory H2 with a different property bundle, so a typo in
prod-only `application-pg-prod.properties` doesn't trip CI.

**Follow-up ticket (do not block this PR):** add a prod-profile context-
load test (one per profile) that asserts the application context starts.
That class of bug — property typos invisible until BG cutover — is
trivially caught by such a test.

## Other R6 PRs investigated and cleared

Java diff `16d05e498..8344295f5` (last working commit → last commit
included in bad jar) showed:

- `NormalizedFilenameMultipartFile.java` + `MultipartFilenameNormalizer.java`
  (NEW, PR #493). Pure utility classes, no Spring annotations — cannot
  cause startup failure on their own.
- 5 controllers in PR #489 with `@RequirePermission` annotations. Resolver
  is the same resolver already used elsewhere — does not change startup.
- `BomService` / `MaterialBatchService` / `SmartBIUploadController` /
  `SmartBIConfigController` changes — controller-level method additions,
  not bean lifecycle changes.

All cleared. The only commit that introduced a startup-impacting change
was PR #493's properties addition.

## Fix verification

- `mvn clean package -DskipTests` PASS in worktree (build SUCCESS at
  2026-05-12 22:53:18 -0400, 1m 28s).
- `deploy-backend.sh --env test` → 10011 startup [see verification block
  in PR].

## Files changed

- `application.properties` line 47 — drop `spring.servlet.multipart.file-encoding=UTF-8`
- `application-pg.properties` line 84 — same
- `application-pg-prod.properties` line 118 — same
- `application-prod.properties` line 39 — same

Comments updated to reflect that filename UTF-8 recovery is application-
side via `NormalizedFilenameMultipartFile`, not via properties.
