/*
 * One-shot reference dump for java.util.Random + java.lang.String.hashCode.
 *
 * Generates golden values used by Python tests to verify
 * smartbi_compat._java_compat._java_string_hashcode + _JavaRandom bit-exact
 * parity with JDK 21.
 *
 * Run (from repo root):
 *   java backend/python/tests/fixtures/JavaRandomReferenceDump.java \
 *     > backend/python/tests/fixtures/java-random-reference.json
 *
 * Re-run when adding new test seeds or factory IDs. Commit both the .java
 * source and the .json output so any sister chat can reproduce + extend.
 */
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.Random;

public class JavaRandomReferenceDump {

    private static String esc(String s) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\') out.append("\\\\");
            else if (c == '"') out.append("\\\"");
            else if (c == '\n') out.append("\\n");
            else if (c == '\r') out.append("\\r");
            else if (c == '\t') out.append("\\t");
            else if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
            else out.append(c);
        }
        return out.toString();
    }

    private static String dumpInts(long seed, int bound, int n) {
        Random r = new Random(seed);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(",");
            sb.append(r.nextInt(bound));
        }
        sb.append("]");
        return sb.toString();
    }

    private static String dumpDoubles(long seed, int n) {
        Random r = new Random(seed);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(",");
            // Use Long.toHexString of the raw bits to preserve bit-exact value
            // through JSON. Python rebuilds via struct.unpack('>d', bytes.fromhex(...)).
            double d = r.nextDouble();
            long bits = Double.doubleToRawLongBits(d);
            sb.append("\"").append(String.format("%016x", bits)).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    /** Mirror production/quality mock generator's per-record consumption order:
     *   nextInt(8), nextDouble(), nextInt(100), nextDouble(), nextDouble(),
     *   nextInt(3), nextInt(5)  — 7 calls per record.
     */
    private static String dumpMixedRecords(long seed, int recordCount) {
        Random r = new Random(seed);
        StringBuilder sb = new StringBuilder("[");
        for (int rec = 0; rec < recordCount; rec++) {
            if (rec > 0) sb.append(",");
            sb.append("{");
            sb.append("\"plannedRuntime\":").append(r.nextInt(8)).append(",");
            sb.append("\"downtime\":\"").append(String.format("%016x",
                    Double.doubleToRawLongBits(r.nextDouble()))).append("\",");
            sb.append("\"theoreticalOutput\":").append(r.nextInt(100)).append(",");
            sb.append("\"actualOutputMult\":\"").append(String.format("%016x",
                    Double.doubleToRawLongBits(r.nextDouble()))).append("\",");
            sb.append("\"goodUnitsMult\":\"").append(String.format("%016x",
                    Double.doubleToRawLongBits(r.nextDouble()))).append("\",");
            sb.append("\"failureCount\":").append(r.nextInt(3)).append(",");
            sb.append("\"downtimeReason\":").append(r.nextInt(5));
            sb.append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    public static void main(String[] args) {
        // Force UTF-8 stdout — JVM default charset is GBK on zh-CN Windows,
        // which corrupts Chinese test strings written via System.out.print.
        System.setOut(new PrintStream(System.out, true, StandardCharsets.UTF_8));

        // Test strings — covers ASCII, factory IDs, hash collisions, Unicode,
        // empty, single char, surrogate-pair-free CJK.
        String[] testStrings = new String[] {
                "",
                "a",
                "ab",
                "abc",
                "F001",
                "F002",
                "F003",
                "F006",
                "F999",
                "RES_3101_001",
                "RES_3101_009",
                "RES_GML_001",
                "FOOD_3101_001",
                "TEST_0000_001",
                "AaAa",   // hash collides with BBBB (well-known)
                "BBBB",   // hash = AaAa = 2031744
                "中文",
                "白垩纪",
                "test"
        };

        long[] seeds = new long[] {
                0L,
                1L,
                -1L,
                42L,
                "F001".hashCode(),       // 2153483
                "F002".hashCode(),
                "F999".hashCode(),
                "RES_3101_001".hashCode(),
                "RES_GML_001".hashCode(),
                Long.MIN_VALUE,
                Long.MAX_VALUE
        };

        StringBuilder out = new StringBuilder();
        out.append("{\n");
        out.append("  \"_meta\": {\n");
        out.append("    \"generator\": \"JavaRandomReferenceDump.java\",\n");
        out.append("    \"jdk_version\": \"").append(esc(System.getProperty("java.version"))).append("\",\n");
        out.append("    \"jdk_vendor\": \"").append(esc(System.getProperty("java.vendor"))).append("\",\n");
        out.append("    \"description\": \"Bit-exact golden values for _java_string_hashcode + _JavaRandom Python port. nextDouble values stored as 16-char hex of doubleToRawLongBits to preserve precision.\"\n");
        out.append("  },\n");

        // 1. String.hashCode() reference values
        out.append("  \"hashcode\": {\n");
        for (int i = 0; i < testStrings.length; i++) {
            String s = testStrings[i];
            out.append("    \"").append(esc(s)).append("\": ").append(s.hashCode());
            if (i < testStrings.length - 1) out.append(",");
            out.append("\n");
        }
        out.append("  },\n");

        // 2. Random sequences for each seed.
        out.append("  \"random_sequences\": [\n");
        for (int s = 0; s < seeds.length; s++) {
            long seed = seeds[s];
            out.append("    {\n");
            out.append("      \"seed\": ").append(seed).append(",\n");
            out.append("      \"next_int_1\": ").append(dumpInts(seed, 1, 10)).append(",\n");
            out.append("      \"next_int_2\": ").append(dumpInts(seed, 2, 30)).append(",\n");
            out.append("      \"next_int_3\": ").append(dumpInts(seed, 3, 30)).append(",\n");
            out.append("      \"next_int_5\": ").append(dumpInts(seed, 5, 30)).append(",\n");
            out.append("      \"next_int_7\": ").append(dumpInts(seed, 7, 30)).append(",\n");
            out.append("      \"next_int_8\": ").append(dumpInts(seed, 8, 30)).append(",\n");
            out.append("      \"next_int_16\": ").append(dumpInts(seed, 16, 30)).append(",\n");
            out.append("      \"next_int_100\": ").append(dumpInts(seed, 100, 30)).append(",\n");
            out.append("      \"next_int_1024\": ").append(dumpInts(seed, 1024, 30)).append(",\n");
            out.append("      \"next_double_30\": ").append(dumpDoubles(seed, 30)).append(",\n");
            out.append("      \"mixed_records_5\": ").append(dumpMixedRecords(seed, 5)).append("\n");
            out.append("    }");
            if (s < seeds.length - 1) out.append(",");
            out.append("\n");
        }
        out.append("  ]\n");
        out.append("}\n");

        System.out.print(out.toString());
    }
}
