# 椋熷搧婧簮绯荤粺 - 璇︾粏鐩綍缁撴瀯璇存槑

> **璇存槑**: 鏈枃妗ｄ粎璁板綍褰撳墠鏈€鏂扮殑鐩綍缁撴瀯锟?> 
> **鍙樻洿鍘嗗彶**: 鐩綍缁撴瀯鐨勫彉鏇村巻鍙茶鏌ョ湅 [docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)

## 馃搳 **褰撳墠椤圭洰鐘讹拷?* (2025-01-31鏇存柊)

### **Phase-3鎶€鏈爤鐜颁唬鍖栫姸锟?*
- **鏋勫缓绯荤粺**: 锟?**浼樼** (1.0绉掑揩閫熸瀯锟? 0閿欒)
- **寮€鍙戠幆锟?*: 锟?**姝ｅ父** (绔彛3000绋冲畾杩愯, 2.1绉掑惎锟?
- **鏍稿績鍔熻兘**: 锟?**瀹屽叏鍙敤** (TASK-P3-016A MVP鎶€鏈柟锟?00%鎴愬姛)
- **娴嬭瘯鐘讹拷?*: 锟?**绋冲畾** (6/6娴嬭瘯閫氳繃, Mock API鏀寔瀹屽杽)
- **鏁翠綋瀹屾垚锟?*: **85-90%** (鏍稿績API Hook绯荤粺瀹屾垚锛屾枃妗ｆ竻鐞嗗畬锟?

### **2025-01-31 - Phase-3鏂囨。娓呯悊鍜屾牳蹇冧换鍔″畬锟?* 锟?**閲岀▼纰戣揪锟?*
- 锟?**TASK-P3-016A MVP鏂规瀹屽叏鎴愬姛**: 5灞傞獙锟?00%閫氳繃锛屾妧鏈柟妗堥獙锟?- 锟?**鏂囨。绯荤粺浼樺寲**: 鍒犻櫎11涓巻鍙查獙璇佹姤鍛婏紝閲婃斁6MB瀛樺偍绌洪棿
- 锟?**鍗曚竴淇℃伅婧愬缓锟?*: Phase-3鏉冨▉鏂囨。缁撴瀯锛岄伩鍏嶄俊鎭垎锟?- 锟?**楠岃瘉鎶ュ憡娓呯悊**: 淇濈暀鏈€鏂版湁鏁堟姤鍛婏紝绗﹀悎cursor瑙勮寖

### **褰撳墠鎶€鏈垚鏋滈獙锟?*
```bash
# MVP楠岃瘉缁撴灉纭
鎬婚獙璇佸眰锟? 5灞傞獙璇佹爣锟?(TypeScript + 鏋勫缓 + 璐ㄩ噺 + 娴嬭瘯 + 鍔熻兘)
楠岃瘉閫氳繃锟? 100% (5/5灞傜骇鍏ㄩ儴閫氳繃)
鎶€鏈柟妗堥獙锟? MVP瀵煎悜鏋舵瀯锛岄伩鍏嶈繃搴﹀伐绋嬪寲

# 褰撳墠椤圭洰鐘讹拷?鏋勫缓鏃堕棿: 1.0锟?(鏄捐憲浼樹簬鍩虹嚎)
寮€鍙戝惎锟? 2.1锟?(蹇€熷惎锟?
娴嬭瘯閫氳繃锟? 100% (6/6娴嬭瘯閫氳繃)
鏂囨。鐘讹拷? 娓呯悊瀹屾垚锛屽崟涓€淇℃伅婧愬缓锟?```

### **褰撳墠鍙敤鍔熻兘**
- 锟?**杩愯 `npm run dev`**: 绔彛3004锟?绉掑惎锟?- 锟?**鎵ц `npm run build`**: 绋冲畾鏋勫缓
- 锟?**杩愯 `npm test`**: 娴嬭瘯鐜绋冲畾鎵ц
- 锟?**TypeScript缂栬瘧妫€锟?*: 4.7锟? 0閿欒
- 锟?**ESLint浠ｇ爜璐ㄩ噺妫€锟?*: 姝ｅ父閫氳繃
- 锟?**API Hook绯荤粺**: 鍩虹鍔熻兘70%瀹屾垚

### **椤圭洰鐘舵€佽锟?*
- `web-app/`: 鍘熸湁绯荤粺 (绋冲畾杩愯)
- `web-app-next/`: Phase-3鐜颁唬鍖栫増锟?(鏍稿績鍔熻兘淇瀹屾垚锛屽熀鏈彲锟?
- `refactor/phase-3/`: Phase-3瑙勫垝鍜岀姸鎬佹枃锟?(鐘舵€佸凡鏇存柊涓轰慨澶嶅悗鐨勭湡瀹炴儏锟?

## 1. 鏍圭洰褰曠粨锟?
```
.
鈹溾攢鈹€ web-app/                   # Web搴旂敤涓荤洰锟?鈹溾攢鈹€ docs/                      # 椤圭洰鏂囨。
锟?  鈹溾攢鈹€ architecture/          # 鏋舵瀯鏂囨。
锟?  锟?  鈹溾攢鈹€ overview.md        # 绯荤粺鏋舵瀯姒傝
锟?  锟?  鈹溾攢鈹€ design-principles.md # 鏋舵瀯璁捐鍘熷垯
锟?  锟?  鈹斺攢鈹€ technologies.md    # 鎶€鏈爤璇存槑
锟?  鈹溾攢鈹€ api/                   # API鏂囨。
锟?  锟?  鈹溾攢鈹€ README.md          # API鏂囨。绱㈠紩鍜屾锟?锟?  锟?  鈹溾攢鈹€ api-specification.md # 瀹屾暣API鎺ュ彛瑙勮寖(鏉冨▉鏉ユ簮) 锟?鏂板AI鎺ュ彛
锟?  锟?  鈹溾攢鈹€ ai-analytics.md    # AI鏁版嵁鍒嗘瀽API鎺ュ彛瑙勮寖 锟?MVP鏍稿績 锟?鏂板
锟?  锟?  鈹溾攢鈹€ mock-api-guide.md  # Mock API瀹屾暣浣跨敤鎸囧崡 锟?鏇存柊AI鎺ュ彛
锟?  锟?  鈹溾攢鈹€ overview.md        # API姒傝
锟?  锟?  鈹溾攢鈹€ trace.md           # 婧簮API鏂囨。
锟?  锟?  鈹溾攢鈹€ authentication.md  # 璁よ瘉API鏂囨。
锟?  锟?  鈹溾攢鈹€ farming.md         # 鍐滀笟妯″潡API鏂囨。
锟?  锟?  鈹溾攢鈹€ processing.md      # 鍔犲伐妯″潡API鏂囨。
锟?  锟?  鈹溾攢鈹€ logistics.md       # 鐗╂祦妯″潡API鏂囨。
锟?  锟?  鈹溾攢鈹€ admin.md           # 绠＄悊妯″潡API鏂囨。
锟?  锟?  鈹溾攢鈹€ profile.md         # 鐢ㄦ埛涓績API鏂囨。
锟?  锟?  鈹斺攢鈹€ data-models.md     # 缁熶竴鏁版嵁妯″瀷鏂囨。
锟?  鈹溾攢鈹€ components/            # 缁勪欢鏂囨。
锟?  锟?  鈹溾攢鈹€ overview.md        # 缁勪欢姒傝
锟?  锟?  鈹溾攢鈹€ common/            # 閫氱敤缁勪欢鏂囨。
锟?  锟?  锟?  鈹斺攢鈹€ index.md       # 閫氱敤缁勪欢绱㈠紩
锟?  锟?  鈹斺攢鈹€ modules/           # 涓氬姟妯″潡缁勪欢鏂囨。
锟?  锟?      鈹斺攢鈹€ index.md       # 涓氬姟缁勪欢绱㈠紩
锟?  鈹溾攢鈹€ guides/                # 寮€鍙戞寚锟?锟?  锟?  鈹斺攢鈹€ getting-started.md # 蹇€熷紑濮嬫寚锟?锟?  鈹溾攢鈹€ prd/                   # 浜у搧闇€姹傛枃锟?锟?  鈹溾攢鈹€ archive/               # 褰掓。鏂囨。
锟?  鈹斺攢鈹€ project-management/    # 椤圭洰绠＄悊鏂囨。
鈹溾攢鈹€ scripts/                   # 宸ュ叿鑴氭湰鐩綍
锟?  鈹溾攢鈹€ build/                 # 鏋勫缓鐩稿叧鑴氭湰
锟?  鈹溾攢鈹€ deploy/                # 閮ㄧ讲鐩稿叧鑴氭湰
锟?  鈹溾攢鈹€ dev/                   # 寮€鍙戠幆澧冪浉鍏宠剼锟?锟?  锟?  鈹溾攢鈹€ git/               # Git鐩稿叧寮€鍙戣剼锟?锟?  锟?  锟?  鈹溾攢鈹€ tools/         # Git宸ュ叿鑴氭湰
锟?  锟?  锟?  锟?  鈹溾攢鈹€ git-tools.ps1  # PowerShell鐗堟湰
锟?  锟?  锟?  锟?  鈹溾攢鈹€ git-tools.bat  # 鎵瑰鐞嗙増锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ git-tools.sh   # Shell鐗堟湰
锟?  锟?  锟?  锟?  鈹斺攢鈹€ README.md      # 浣跨敤璇存槑
锟?  锟?  鈹斺攢鈹€ debug/             # 璋冭瘯鐩稿叧鑴氭湰
锟?  鈹溾攢鈹€ data/                  # 鏁版嵁澶勭悊鐩稿叧鑴氭湰
锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿绫昏剼锟?锟?  锟?  鈹溾攢鈹€ modules/           # 妯″潡鐩稿叧宸ュ叿鑴氭湰
锟?  锟?  鈹溾攢鈹€ button-fixes/      # 鎸夐挳淇鐩稿叧鑴氭湰
锟?  锟?  鈹斺攢鈹€ resource-fixes/    # 璧勬簮淇鐩稿叧鑴氭湰
锟?  鈹溾攢鈹€ validation/            # 楠岃瘉鐩稿叧鑴氭湰锛圥hase-2閲嶆瀯楠岃瘉锟?锟?  锟?  鈹溾攢鈹€ common/            # 閫氱敤楠岃瘉宸ュ叿
锟?  锟?  鈹溾攢鈹€ reports/           # 楠岃瘉鎶ュ憡
锟?  锟?  鈹溾攢鈹€ scripts/           # 楠岃瘉瀛愯剼锟?锟?  锟?  鈹溾攢鈹€ task-005/          # TASK-005楠岃瘉
锟?  锟?  锟?  鈹斺攢鈹€ reports/       # 楠岃瘉鎶ュ憡
锟?  锟?  鈹溾攢鈹€ task-p2-001/       # TASK-P2-001绉诲姩绔€傞厤楠岃瘉
锟?  锟?  锟?  鈹斺攢鈹€ reports/       # 楠岃瘉鎶ュ憡
锟?  锟?  鈹溾攢鈹€ task-p2-002/       # TASK-P2-002UI缁勪欢缁勭粐楠岃瘉
锟?  锟?  锟?  鈹斺攢鈹€ reports/       # 楠岃瘉鎶ュ憡
锟?  锟?  鈹溾攢鈹€ task-p3-016a/      # TASK-P3-016A React Hook瀵煎嚭绯荤粺楠岃瘉 锟?宸插畬锟?锟?  锟?  锟?  鈹溾攢鈹€ comprehensive-validation.js  # 涓婚獙璇佽剼锟?5灞傞獙璇佹灦锟? 锟?锟?  锟?  锟?  鈹溾攢鈹€ comprehensive-validation-mvp.js  # MVP鐗堟湰楠岃瘉鑴氭湰 锟?锟?  锟?  锟?  鈹溾攢鈹€ reports/       # 楠岃瘉缁撴灉鎶ュ憡 锟?(鍘嗗彶鏂囦欢宸叉竻锟?
锟?  锟?  锟?  锟?  鈹斺攢鈹€ mvp-validation-report-1748629356391.json  # 鏈€鏂癕VP楠岃瘉鎶ュ憡(3.9KB) 锟?锟?  锟?  锟?  鈹斺攢鈹€ scripts/       # 杈呭姪楠岃瘉鑴氭湰 锟?锟?  锟?  鈹溾攢鈹€ task-p3-016b/      # TASK-P3-016B 绂荤嚎闃熷垪绯荤粺楠岃瘉 锟?鏂板
锟?  锟?  锟?  鈹溾攢鈹€ comprehensive-validation.js  # 涓婚獙璇佽剼锟?锟?锟?  锟?  锟?  鈹斺攢鈹€ reports/       # 楠岃瘉鎶ュ憡鐩綍 锟?锟?  锟?  鈹溾攢鈹€ task-api-docs-update/ # API鏂囨。鏇存柊浠诲姟楠岃瘉 锟?鏂板
锟?  锟?  锟?  鈹溾攢鈹€ comprehensive-validation.js  # 鏂囨。瀹屾暣鎬ч獙璇佽剼锟?锟?鏂板
锟?  锟?  锟?  鈹斺攢鈹€ reports/       # 楠岃瘉鎶ュ憡鐩綍 锟?鏂板
锟?  锟?  鈹溾攢鈹€ mobile-adaptation-validation.js    # 绉诲姩绔€傞厤楠岃瘉
锟?  锟?  鈹溾攢鈹€ performance-validation.js          # 鎬ц兘楠岃瘉
锟?  锟?  鈹溾攢鈹€ accessibility-validation.js        # 鍙闂€ч獙锟?锟?  锟?  鈹斺攢鈹€ comprehensive-p2-validation.js     # Phase-2缁煎悎楠岃瘉
锟?  鈹溾攢鈹€ README.md              # 鑴氭湰浣跨敤璇存槑鏂囨。
锟?  鈹斺攢鈹€ SCRIPT_INVENTORY.md    # 鑴氭湰娓呭崟
鈹溾攢鈹€ refactor/                  # 閲嶆瀯鐩稿叧鏂囨。鍜岃剼锟?锟?  鈹溾攢鈹€ docs/                  # 閲嶆瀯鏂囨。
锟?  锟?  鈹溾攢鈹€ plan.md            # 閲嶆瀯鎬讳綋璁″垝
锟?  锟?  鈹斺攢鈹€ guidelines.md      # 閲嶆瀯鎸囧崡
锟?  鈹溾攢鈹€ assets/                # 閲嶆瀯鐩稿叧璧勬簮鏂囦欢
锟?  鈹溾攢鈹€ REFACTOR_LOG.md        # 閲嶆瀯鏃ュ織璁板綍
锟?  鈹溾攢鈹€ README.md              # 閲嶆瀯璇存槑鏂囨。
锟?  鈹溾攢鈹€ phase-1/               # 闃舵涓€锛氱粨鏋勬竻鐞嗕笌缁熶竴 (宸插畬锟?
锟?  锟?  鈹溾攢鈹€ PHASE-1-WORK-PLAN.md       # 闃舵涓€宸ヤ綔璁″垝
锟?  锟?  鈹溾攢鈹€ TASKS.md           # 浠诲姟鍒楄〃
锟?  锟?  鈹溾攢鈹€ progress-reports/  # 杩涘害鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ task002_progress.md # TASK-002杩涘害鎶ュ憡
锟?  锟?  锟?  鈹斺攢鈹€ task007_progress.md # TASK-007杩涘害鎶ュ憡
锟?  锟?  鈹斺攢鈹€ results/           # 瀹屾垚鎶ュ憡
锟?  锟?      鈹溾攢鈹€ TASK-001_completion_report.md # TASK-001瀹屾垚鎶ュ憡
锟?  锟?      鈹溾攢鈹€ TASK-002_completion_report.md # TASK-002瀹屾垚鎶ュ憡
锟?  锟?      鈹溾攢鈹€ TASK-004_completion_report.md # TASK-004瀹屾垚鎶ュ憡
锟?  锟?      鈹斺攢鈹€ TASK-007_completion_report.md # TASK-007瀹屾垚鎶ュ憡
锟?  鈹溾攢鈹€ phase-2/               # 闃舵浜岋細浠ｇ爜浼樺寲涓庢ā鍧楀寲 (杩涜锟?
锟?  锟?  鈹溾攢鈹€ PHASE-2-WORK-PLAN.md       # 闃舵浜屽伐浣滆锟?锟?  锟?  鈹溾攢鈹€ README.md          # 闃舵浜岃鏄庢枃锟?锟?  锟?  鈹溾攢鈹€ TASKS.md           # 闃舵浜屼换鍔″垪锟?锟?  锟?  鈹溾攢鈹€ tasks/             # 鍏蜂綋浠诲姟鏂囨。
锟?  锟?  锟?  鈹溾攢鈹€ TASK_TEMPLATE.md                    # 浠诲姟妯℃澘
锟?  锟?  锟?  鈹溾攢鈹€ TASK-005_浠ｇ爜妯″潡鍖栨敼锟?md           # 浠ｇ爜妯″潡鍖栦换锟?锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-001_绉诲姩绔疷I閫傞厤闂淇.md  # 绉诲姩绔€傞厤浠诲姟
锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-002_OrganizeUIComponents.md # UI缁勪欢缁勭粐浠诲姟
锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-003_ModularizeUtilFunctions.md # 宸ュ叿鍑芥暟妯″潡锟?锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-004_ImplementFluidLayouts.md   # 娴佸紡甯冨眬瀹炵幇
锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-005_浼樺寲鐧诲綍椤甸潰绉诲姩绔€傞厤.md  # 鐧诲綍椤甸潰浼樺寲
锟?  锟?  锟?  鈹溾攢鈹€ TASK-P2-006_甯冨眬缁勪欢鎷撳睍.md           # 甯冨眬缁勪欢鎵╁睍
锟?  锟?  锟?  鈹斺攢鈹€ TASK-P2-007_API鎺ュ彛鏂囨。瀹屽杽.md       # API鎺ュ彛鏂囨。瀹屽杽
锟?  锟?  鈹溾攢鈹€ progress-reports/  # 杩涘害鎶ュ憡
锟?  锟?  锟?  鈹斺攢鈹€ PROGRESS_TEMPLATE.md  # 杩涘害鎶ュ憡妯℃澘
锟?  锟?  鈹斺攢鈹€ review-notes/      # 璇勫璁板綍
锟?  锟?      鈹斺攢鈹€ REVIEW_TEMPLATE.md    # 璇勫璁板綍妯℃澘
锟?  鈹溾攢鈹€ phase-3/               # 闃舵涓夛細鎶€鏈爤鐜颁唬锟?(杩涜锟?85-90%)
锟?  锟?  鈹溾攢鈹€ PHASE-3-MASTER-STATUS.md   # Phase-3鏉冨▉鐘舵€佹枃锟?锟?鍗曚竴淇℃伅锟?锟?  锟?  鈹溾攢鈹€ PHASE-3-COMPREHENSIVE-PLAN.md       # 闃舵涓夎缁嗗伐浣滆锟?锟?  锟?  鈹溾攢鈹€ REFACTOR-PHASE3-CHANGELOG.md # Phase-3涓撻棬鍙樻洿鏃ュ織
锟?  锟?  鈹溾攢鈹€ TASK-P3-016A-UNIFIED-STATUS.md # TASK-P3-016A缁熶竴鐘舵€佽拷锟?锟?鏂版暣锟?锟?  锟?  鈹溾攢鈹€ docs/              # 闃舵涓夋枃锟?锟?  锟?  锟?  鈹溾攢鈹€ TECH-SELECTION.md     # 鎶€鏈€夊瀷鍐崇瓥
锟?  锟?  锟?  鈹溾攢鈹€ MIGRATION-STRATEGY.md # 杩佺Щ绛栫暐
锟?  锟?  锟?  鈹斺攢鈹€ COMPONENT-MIGRATION-GUIDE.md # 缁勪欢杩佺Щ鎸囧
锟?  锟?  鈹溾攢鈹€ progress-reports/  # 杩涘害鎶ュ憡
锟?  锟?  鈹溾攢鈹€ review-notes/      # 璇勫璁板綍
锟?  锟?  鈹斺攢鈹€ tasks/             # 浠诲姟鏂囨。
锟?  锟?      鈹溾攢鈹€ TASK-P3-001_鍓嶇妗嗘灦杩佺Щ璇勪及涓庨€夊瀷.md # 鎶€鏈€夊瀷浠诲姟(宸插畬锟?
锟?  锟?      鈹溾攢鈹€ TASK-P3-007_缁勪欢搴撶幇浠ｅ寲杩佺Щ.md        # 缁勪欢搴撶幇浠ｅ寲(宸插畬锟?00%)
锟?  锟?      鈹斺攢鈹€ TASK-P3-014_Next.js椤圭洰鏍囧噯鍖栦笌閰嶇疆瀹屽杽.md # 椤圭洰鏍囧噯锟?宸插畬锟?00%)
锟?  鈹斺攢鈹€ phase-4/               # 闃舵鍥涳細鎬ц兘涓庡畨鍏ㄤ紭锟?(鏈紑锟?
锟?      鈹溾攢鈹€ PHASE-4-WORK-PLAN.md       # 闃舵鍥涘伐浣滆锟?锟?      鈹溾攢鈹€ progress-reports/  # 杩涘害鎶ュ憡
锟?      鈹溾攢鈹€ review-notes/      # 璇勫璁板綍
锟?      鈹斺攢鈹€ tasks/             # 浠诲姟鏂囨。
鈹溾攢鈹€ .github/                   # GitHub閰嶇疆
锟?  鈹斺攢鈹€ workflows/             # GitHub Actions宸ヤ綔娴佺▼
锟?      鈹溾攢鈹€ build.yml          # 鏋勫缓宸ヤ綔锟?锟?      鈹斺攢鈹€ test.yml           # 娴嬭瘯宸ヤ綔锟?鈹溾攢鈹€ .husky/                    # Git閽╁瓙閰嶇疆
锟?  鈹溾攢鈹€ pre-commit             # 鎻愪氦鍓嶉挬锟?锟?  鈹斺攢鈹€ commit-msg             # 鎻愪氦娑堟伅閽╁瓙
鈹溾攢鈹€ .cursor/                   # Cursor AI缂栬緫鍣ㄩ厤锟?锟?  鈹斺攢鈹€ rules/                 # Cursor瑙勫垯鏂囦欢鐩綍
锟?      鈹溾攢鈹€ development-modules/                   # 涓撲笟妯″潡鐩綍 (鏂板)
锟?      鈹溾攢鈹€ development-management-unified.mdc     # 缁熶竴寮€鍙戠鐞嗚锟?(铻嶅悎3涓師瑙勫垯)
锟?      鈹溾攢鈹€ task-management-manual.mdc             # 浠诲姟绠＄悊瑙勮寖
锟?      锟?  鈹溾攢鈹€ core-principles-detailed.mdc      # 鏍稿績寮€鍙戝師鍒欒缁嗘寚锟?锟?      锟?  鈹溾攢鈹€ project-management-detailed.mdc   # 椤圭洰绠＄悊璇︾粏瑙勮寖  
锟?      锟?  鈹斺攢鈹€ workflow-procedures-detailed.mdc  # 宸ヤ綔娴佺▼璇︾粏瑙勮寖
锟?      鈹溾攢鈹€ refactor-phase2-agent.mdc             # 閲嶆瀯闃舵浜屼唬鐞嗚锟?锟?      鈹溾攢鈹€ refactor-phase3-agent.mdc             # 閲嶆瀯闃舵涓変唬鐞嗚锟?2025-05-27鏇存柊)
锟?      鈹溾攢鈹€ ui-design-system-auto.mdc             # UI璁捐绯荤粺瑙勮寖
锟?      鈹溾攢鈹€ api-interface-design-agent.mdc        # API鎺ュ彛璁捐瑙勮寖
锟?      鈹溾攢鈹€ documentation-deduplication-manual.mdc # 鏂囨。鍘婚噸瑙勮寖
锟?      鈹溾攢鈹€ test-validation-standards-manual.mdc   # 娴嬭瘯楠岃瘉鏂囦欢瑙勮寖鍖栬锟?锟?      鈹斺攢鈹€ cursor-rules.mdc                      # 瑙勫垯绱㈠紩鏂囦欢
鈹溾攢鈹€ .vscode/                   # VS Code閰嶇疆
锟?  鈹溾攢鈹€ settings.json          # 椤圭洰鐗瑰畾璁剧疆
锟?  鈹溾攢鈹€ extensions.json        # 鎺ㄨ崘鎵╁睍
锟?  鈹斺攢鈹€ launch.json            # 璋冭瘯閰嶇疆
鈹溾攢鈹€ .next/                    # Next.js鏋勫缓杈撳嚭
鈹溾攢鈹€ node_modules/             # 渚濊禆锟?鈹溾攢鈹€ docs/                      # 椤圭洰鏂囨。 锟?鏂板
锟?  鈹斺攢鈹€ migration-guide-useApi-v2.md # useApi-v2杩佺Щ鎸囧崡涓嶢PI瀵圭収锟?锟?鏂板
鈹溾攢鈹€ package.json               # 椤圭洰渚濊禆閰嶇疆
鈹溾攢鈹€ package-lock.json          # 渚濊禆閿佸畾鏂囦欢
鈹溾攢鈹€ workspace.json             # 宸ヤ綔鍖洪厤缃枃锟?鈹溾攢鈹€ vercel.json                # Vercel閮ㄧ讲閰嶇疆
鈹溾攢鈹€ test-server.js             # 娴嬭瘯鏈嶅姟锟?鈹溾攢鈹€ .gitignore                 # Git蹇界暐鏂囦欢
鈹溾攢鈹€ README.md                  # 椤圭洰璇存槑鏂囨。
鈹溾攢鈹€ README.md.bak              # README澶囦唤鏂囦欢
鈹溾攢鈹€ TASKS.md                   # 椤圭洰浠诲姟姒傝锛堝紩鐢ㄦ潈濞佹潵婧愶級
鈹溾攢鈹€ 閲嶆瀯闃舵璁板綍.md             # 閲嶆瀯闃舵璁板綍
鈹溾攢鈹€ 椤圭洰閲嶆瀯鏂规.md             # 椤圭洰閲嶆瀯鏂规
鈹溾攢鈹€ 鎵€鏈夋枃浠惰В锟?md             # 鎵€鏈夋枃浠惰В閲婃枃锟?鈹溾攢鈹€ index.html                 # 馃幆 椤甸潰棰勮绯荤粺 - 浣跨敤iframe灞曠ず鎵€鏈夐〉闈㈢殑涓诲睍绀洪〉锟?(338锟? 14KB)
鈹溾攢鈹€ coming-soon.html           # 鍗冲皢涓婄嚎椤甸潰 (112锟? 4.6KB)
鈹溾攢鈹€ .next/                    # Next.js鏋勫缓杈撳嚭
鈹溾攢鈹€ node_modules/             # 渚濊禆锟?鈹溾攢鈹€ docs/                      # 椤圭洰鏂囨。 锟?鏂板
锟?  鈹斺攢鈹€ migration-guide-useApi-v2.md # useApi-v2杩佺Щ鎸囧崡涓嶢PI瀵圭収锟?锟?鏂板
鈹溾攢鈹€ package.json              # 椤圭洰閰嶇疆(瀹屽杽锟?- 瀹屾暣鑴氭湰銆乴int-staged閰嶇疆)
鈹溾攢鈹€ package-lock.json         # 渚濊禆閿佸畾
鈹溾攢鈹€ tsconfig.json             # TypeScript閰嶇疆
鈹溾攢鈹€ tailwind.config.ts        # Tailwind CSS閰嶇疆(TypeScript锟?
鈹溾攢鈹€ next.config.ts            # Next.js閰嶇疆
鈹溾攢鈹€ jest.config.js            # Jest娴嬭瘯閰嶇疆(鏂板锟?
鈹溾攢鈹€ .prettierrc               # Prettier閰嶇疆(鏂板锟?
鈹溾攢鈹€ eslint.config.mjs         # ESLint閰嶇疆
鈹溾攢鈹€ postcss.config.mjs        # PostCSS閰嶇疆
鈹溾攢鈹€ env.example               # 鐜鍙橀噺绀轰緥
鈹溾攢鈹€ .gitignore                # Git蹇界暐鏂囦欢
鈹斺攢鈹€ README.md                 # 椤圭洰璇存槑
鈹斺攢鈹€ DIRECTORY_STRUCTURE.md     # 鐩綍缁撴瀯璇︾粏璇存槑锛堟湰鏂囦欢锟?```

## 2. web-app-next鐩綍缁撴瀯 (Phase-3鐜颁唬鍖栨妧鏈爤)

```
web-app-next/
鈹溾攢鈹€ src/
锟?  鈹溾攢鈹€ app/                   # Next.js App Router
锟?  锟?  鈹溾攢鈹€ components/        # 缁勪欢婕旂ず椤甸潰
锟?  锟?  锟?  鈹斺攢鈹€ page.tsx       # 缁勪欢灞曠ず椤甸潰(鍚獴adge銆丼tatCard銆佸竷灞€缁勪欢锟?
锟?  锟?  鈹溾攢鈹€ demo/              # 鍔熻兘婕旂ず椤甸潰
锟?  锟?  锟?  鈹斺攢鈹€ page.tsx       # 鍔熻兘婕旂ず椤甸潰(浠ｇ爜鍒嗗壊鍜屾噿鍔犺浇婕旂ず)
锟?  锟?  鈹溾攢鈹€ globals.css        # 鍏ㄥ眬鏍峰紡
锟?  锟?  鈹溾攢鈹€ layout.tsx         # 鏍瑰竷灞€
锟?  锟?  鈹溾攢鈹€ page.tsx           # 棣栭〉
锟?  锟?  鈹斺攢鈹€ providers.tsx      # 鍏ㄥ眬Provider閰嶇疆
锟?  鈹溾攢鈹€ components/            # 缁勪欢锟?锟?  锟?  鈹溾攢鈹€ ui/                # 鍩虹UI缁勪欢(TypeScript鐜颁唬鍖栫増锟?
锟?  锟?  锟?  鈹溾攢鈹€ advanced-table.tsx # AdvancedTable楂樼骇琛ㄦ牸缁勪欢(鏂板锟?
锟?  锟?  锟?  鈹溾攢鈹€ dynamic-loader.tsx # DynamicLoader鍔ㄦ€佸姞杞界粍锟?鏂板锟?
锟?  锟?  锟?  鈹溾攢鈹€ badge.tsx      # Badge寰界珷缁勪欢绯诲垪(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ stat-card.tsx  # StatCard缁熻鍗＄墖缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ mobile-search.tsx # MobileSearch绉诲姩鎼滅储缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ touch-gesture.tsx # TouchGesture瑙︽懜鎵嬪娍缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ mobile-nav.tsx # MobileNav绉诲姩绔鑸粍锟?瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ fluid-container.tsx # FluidContainer娴佸紡瀹瑰櫒缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ row.tsx        # Row琛屽竷灞€缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ column.tsx     # Column鍒楀竷灞€缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ page-layout.tsx # PageLayout椤甸潰甯冨眬缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ button.tsx     # Button鎸夐挳缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ card.tsx       # Card鍗＄墖缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ modal.tsx      # Modal妯℃€佹缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ loading.tsx    # Loading鍔犺浇缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ input.tsx      # Input杈撳叆妗嗙粍锟?瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ select.tsx     # Select閫夋嫨鍣ㄧ粍锟?瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ textarea.tsx   # Textarea鏂囨湰鍩熺粍锟?瀹屾垚锟?
锟?  锟?  锟?  鈹溾攢鈹€ table.tsx      # Table琛ㄦ牸缁勪欢(瀹屾垚锟?
锟?  锟?  锟?  鈹斺攢鈹€ index.ts       # 缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  鈹溾攢鈹€ collaboration/     # 鍗忎綔鍔熻兘缁勪欢
锟?  锟?  锟?  鈹斺攢鈹€ CollaborativeEditor.tsx # 鍗忎綔缂栬緫鍣ㄧ粍锟?锟?  锟?  鈹溾攢鈹€ common/            # 閫氱敤缁勪欢(棰勭暀)
锟?  锟?  鈹斺攢鈹€ modules/           # 涓氬姟妯″潡缁勪欢(棰勭暀)
锟?  鈹溾攢鈹€ config/                # 搴旂敤閰嶇疆妯″潡(鏂板锟?
锟?  锟?  鈹溾攢鈹€ app.ts             # 搴旂敤鍩虹閰嶇疆(鐜鍙橀噺銆丄PI銆佸姛鑳藉紑锟?
锟?  锟?  鈹溾攢鈹€ constants.ts       # 搴旂敤甯搁噺瀹氫箟(API绔偣銆佽矾鐢便€佷笟鍔″父锟?
锟?  锟?  鈹斺攢鈹€ index.ts           # 閰嶇疆妯″潡瀵煎嚭绱㈠紩
锟?  鈹溾攢鈹€ lib/                   # 宸ュ叿搴撲笌鏍稿績鍔熻兘
锟?  锟?  鈹溾攢鈹€ utils.ts           # 宸ュ叿鍑芥暟锟?cn鍒嗙被銆佹棩鏈熸牸寮忓寲銆侀槻鎶栬妭娴佺瓑)
锟?  锟?  鈹溾攢鈹€ network-detector.ts # 缃戠粶鐘舵€佹娴嬪櫒(浜嬩欢绯荤粺銆佽繛鎺ヨ川閲忔锟? 锟?锟?  锟?  鈹溾攢鈹€ storage.ts         # 瀛樺偍宸ュ叿锟?LocalStorage銆佹暟鎹帇缂┿€佺増鏈帶锟? 锟?锟?  锟?  鈹溾攢鈹€ offline-queue.ts   # 绂荤嚎闃熷垪鏍稿績妯″潡(浼樺厛绾ч槦鍒椼€佹寔涔呭寲銆佷簨浠剁郴锟? 锟?锟?  锟?  鈹溾攢鈹€ operation-executor.ts # 鎿嶄綔鎵ц锟?HTTP瀹㈡埛绔€佹壒閲忓鐞嗐€侀敊璇锟? 锟?锟?  锟?  鈹溾攢鈹€ error-handler.ts   # 閿欒澶勭悊锟?鏅鸿兘鍒嗙被銆侀噸璇曠瓥鐣ャ€佹寚鏁伴€€锟? 锟?锟?  锟?  鈹溾攢鈹€ sync-manager.ts    # 鍚屾绠＄悊锟?鍗忚皟鍣ㄣ€佹櫤鑳借皟搴︺€佸苟鍙戞帶锟? 锟?锟?  锟?  鈹溾攢鈹€ constants.ts       # 甯搁噺瀹氫箟
锟?  锟?  鈹溾攢鈹€ api.ts             # API瀹㈡埛锟?鍑嗗鎵╁睍鍔熻兘闆嗘垚绂荤嚎闃熷垪 - TASK-P3-016) 馃攧
锟?  锟?  鈹溾攢鈹€ performance-optimizer.ts # 鎬ц兘浼樺寲宸ュ叿
锟?  锟?  鈹溾攢鈹€ persist-config.ts  # 鎸佷箙鍖栭厤锟?锟?  锟?  鈹溾攢鈹€ websocket.ts       # WebSocket宸ュ叿
锟?  锟?  鈹斺攢鈹€ ai-service.ts      # AI鏈嶅姟闆嗘垚
锟?  鈹溾攢鈹€ store/                 # 鐘舵€佺锟?Zustand + TypeScript 鐜颁唬鍖栤渽 - 鍑嗗鏂规A鏋舵瀯璋冩暣馃攧)
锟?  锟?  鈹溾攢鈹€ appStore.ts        # 鍏ㄥ眬搴旂敤鐘舵€佺锟?鍑嗗鎭㈠绂荤嚎闃熷垪闆嗘垚 - 鏂规A) 馃攧
锟?  锟?  鈹溾攢鈹€ auth.ts            # 鍘熸湁璁よ瘉鐘舵€佺锟?绠€鍖栫増鏈紝淇濈暀鍏煎锟?
锟?  锟?  鈹溾攢鈹€ authStore.ts       # 璁よ瘉鐘舵€佺锟?浼佷笟绾у畬鏁寸増鏈細鐧诲綍銆佹潈闄愩€佷护鐗岀鐞嗙瓑)
锟?  锟?  鈹溾攢鈹€ userStore.ts       # 鐢ㄦ埛鍋忓ソ璁剧疆绠＄悊(浠〃鏉裤€佽〃鏍笺€佹樉绀鸿缃瓑)
锟?  锟?  鈹斺攢鈹€ dashboardStore.ts  # 浠〃鏉跨姸鎬佺锟?鏂板锟?
锟?  鈹溾攢鈹€ types/                 # TypeScript绫诲瀷瀹氫箟(瀹屽杽锟?
锟?  锟?  鈹溾攢鈹€ state.ts           # 鐘舵€佺鐞嗙被鍨嬪畾锟?306琛屽畬鏁翠笟鍔＄被鍨嬩綋锟?
锟?  锟?  鈹溾攢鈹€ offline.ts         # 绂荤嚎闃熷垪鐩稿叧绫诲瀷瀹氫箟(瀹屾暣鐨凾ypeScript绫诲瀷绯荤粺) 锟?锟?  锟?  鈹斺攢鈹€ index.ts           # 鍏ㄥ眬绫诲瀷瀹氫箟
锟?  鈹溾攢鈹€ hooks/                 # 鑷畾涔塇ooks
锟?  锟?  鈹溾攢鈹€ useApi.ts          # API瀹㈡埛绔疕ook(鍘熺増鏈紝淇濇寔鍏煎鎬э紝娣诲姞@deprecated鏍囪) 锟?锟?  锟?  鈹溾攢鈹€ useApi-v2.ts       # 鐜颁唬鍖朅PI瀹㈡埛绔疕ook(瑙ｅ喅鏃犻檺寰幆闂) 锟?鏂板
锟?  锟?  鈹斺攢鈹€ index.ts           # Hooks瀵煎嚭绱㈠紩(鏂板锟?
锟?  鈹溾攢鈹€ services/              # API鏈嶅姟锟?鏂板锟?
锟?  锟?  鈹斺攢鈹€ index.ts           # 鏈嶅姟瀵煎嚭绱㈠紩
锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿鍑芥暟(鏂板锟?
锟?  锟?  鈹斺攢鈹€ index.ts           # 宸ュ叿鍑芥暟瀵煎嚭绱㈠紩
锟?  鈹斺攢鈹€ styles/                # 鏍峰紡鏂囦欢
锟?      鈹溾攢鈹€ globals/           # 鍏ㄥ眬鏍峰紡
锟?      锟?  鈹溾攢鈹€ reset.css      # CSS閲嶇疆
锟?      锟?  鈹斺攢鈹€ variables.css  # CSS鍙橀噺
锟?      鈹斺攢鈹€ utilities/         # 宸ュ叿绫绘牱锟?锟?          鈹斺攢鈹€ animations.css # 鍔ㄧ敾鏍峰紡
鈹溾攢鈹€ tests/                     # 娴嬭瘯鏂囦欢(鏂板锟?
锟?  鈹溾攢鈹€ setup.ts              # 娴嬭瘯鐜璁剧疆
锟?  鈹斺攢鈹€ unit/                 # 鍗曞厓娴嬭瘯
锟?      鈹溾攢鈹€ components/       # 缁勪欢娴嬭瘯
锟?      锟?  鈹斺攢鈹€ button.test.tsx # Button缁勪欢娴嬭瘯绀轰緥
锟?      鈹斺攢鈹€ hooks/            # Hook娴嬭瘯 锟?鏂板
锟?          鈹斺攢鈹€ useApi-comparison.test.tsx # useApi V1/V2鍔熻兘涓€鑷存€ф瘮杈冩祴锟?锟?鏂板
鈹溾攢鈹€ public/                    # 闈欐€佽祫锟?锟?  鈹溾攢鈹€ assets/               # 璧勬簮鏂囦欢
锟?  锟?  鈹溾攢鈹€ icons/            # 鍥炬爣鏂囦欢
锟?  锟?  鈹溾攢鈹€ images/           # 鍥剧墖鏂囦欢
锟?  锟?  鈹斺攢鈹€ media/            # 濯掍綋鏂囦欢
锟?  鈹斺攢鈹€ fonts/                # 瀛椾綋鏂囦欢
鈹溾攢鈹€ .vscode/                  # VSCode閰嶇疆(鏂板锟?
锟?  鈹溾攢鈹€ settings.json         # 椤圭洰鐗瑰畾璁剧疆(TypeScript銆佹牸寮忓寲銆乀ailwind)
锟?  鈹溾攢鈹€ extensions.json       # 鎺ㄨ崘鎵╁睍(Prettier銆丒SLint銆乀ailwind锟?
锟?  鈹斺攢鈹€ launch.json           # 璋冭瘯閰嶇疆(Next.js鍏ㄦ爤璋冭瘯)
鈹溾攢鈹€ .husky/                   # Git閽╁瓙閰嶇疆(鏂板锟?
锟?  鈹溾攢鈹€ pre-commit            # 鎻愪氦鍓嶉挬锟?lint-staged)
锟?  鈹斺攢鈹€ commit-msg            # 鎻愪氦娑堟伅閽╁瓙(棰勭暀commitlint)
鈹溾攢鈹€ .next/                    # Next.js鏋勫缓杈撳嚭
鈹溾攢鈹€ node_modules/             # 渚濊禆锟?鈹溾攢鈹€ package.json              # 椤圭洰閰嶇疆(瀹屽杽锟?- 瀹屾暣鑴氭湰銆乴int-staged閰嶇疆)
鈹溾攢鈹€ package-lock.json         # 渚濊禆閿佸畾
鈹溾攢鈹€ tsconfig.json             # TypeScript閰嶇疆
鈹溾攢鈹€ tailwind.config.ts        # Tailwind CSS閰嶇疆(TypeScript锟?
鈹溾攢鈹€ next.config.ts            # Next.js閰嶇疆
鈹溾攢鈹€ jest.config.js            # Jest娴嬭瘯閰嶇疆(鏂板锟?
鈹溾攢鈹€ .prettierrc               # Prettier閰嶇疆(鏂板锟?
鈹溾攢鈹€ eslint.config.mjs         # ESLint閰嶇疆
鈹溾攢鈹€ postcss.config.mjs        # PostCSS閰嶇疆
鈹溾攢鈹€ env.example               # 鐜鍙橀噺绀轰緥
鈹溾攢鈹€ .gitignore                # Git蹇界暐鏂囦欢
鈹斺攢鈹€ README.md                 # 椤圭洰璇存槑
```

## 3. web-app鐩綍缁撴瀯 (Phase-2浼犵粺鎶€鏈爤)

```
web-app/
鈹溾攢鈹€ implementation-plan.md    # Web搴旂敤鍔熻兘寮€鍙戝疄鏂借锟?鈹溾攢鈹€ api-router.js              # API璺敱閰嶇疆
鈹溾攢鈹€ local-server.js            # 鏈湴寮€鍙戞湇鍔″櫒
鈹溾攢鈹€ test-data.js               # 娴嬭瘯鏁版嵁
鈹溾攢鈹€ server.js                  # 鏈嶅姟鍣ㄩ厤锟?鈹溾攢鈹€ index.html                 # 涓婚〉闈㈠叆锟?鈹溾攢鈹€ coming-soon.html           # 鍗冲皢涓婄嚎椤甸潰
鈹溾攢鈹€ package.json               # Web搴旂敤渚濊禆閰嶇疆
鈹溾攢鈹€ package-lock.json          # 渚濊禆閿佸畾鏂囦欢
鈹溾攢鈹€ webpack.config.js          # Webpack閰嶇疆
鈹溾攢鈹€ .babelrc                   # Babel閰嶇疆
鈹溾攢鈹€ vercel.json                # Vercel閮ㄧ讲閰嶇疆
鈹溾攢鈹€ README.md                  # Web搴旂敤璇存槑鏂囨。
鈹溾攢鈹€ src/                       # 婧愪唬鐮佺洰锟?锟?  鈹溾攢鈹€ components/            # 缁勪欢鐩綍
锟?  锟?  鈹溾攢鈹€ common/            # 閫氱敤缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ Button/        # 鎸夐挳缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js   # 瀵煎嚭鍏ュ彛
锟?  锟?  锟?  锟?  鈹溾攢鈹€ Button.jsx # 缁勪欢瀹炵幇
锟?  锟?  锟?  锟?  鈹溾攢鈹€ Button.module.css # 缁勪欢鏍峰紡
锟?  锟?  锟?  锟?  鈹斺攢鈹€ Button.test.js # 缁勪欢娴嬭瘯
锟?  锟?  锟?  鈹溾攢鈹€ Input/         # 杈撳叆妗嗙粍锟?锟?  锟?  锟?  鈹溾攢鈹€ Select/        # 閫夋嫨妗嗙粍锟?锟?  锟?  锟?  鈹溾攢鈹€ Modal/         # 妯℃€佹缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ Card/          # 鍗＄墖缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ Table/         # 琛ㄦ牸缁勪欢
锟?  锟?  锟?  鈹斺攢鈹€ ...            # 鍏朵粬閫氱敤缁勪欢
锟?  锟?  鈹溾攢鈹€ modules/           # 涓氬姟妯″潡缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ trace/         # 婧簮鐩稿叧缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ TraceRecordView.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勬函婧愯褰曡鍥剧粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ TraceRecordForm.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勬函婧愯褰曡〃鍗曠粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js           # 杩芥函妯″潡缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  锟?  锟?  鈹溾攢鈹€ TraceQuery/        # 婧簮鏌ヨ缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹溾攢鈹€ TraceResult/       # 婧簮缁撴灉缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹溾攢鈹€ TraceTimeline/     # 婧簮鏃堕棿绾跨粍浠讹紙浼犵粺锟?锟?  锟?  锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬婧簮缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ farming/       # 鍐滀笟/鍏绘畺鐩稿叧缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ FarmingRecordView.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勫吇娈栬褰曡鍥剧粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js           # 鍏绘畺妯″潡缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  锟?  锟?  鈹溾攢鈹€ DataCollection/    # 鏁版嵁閲囬泦缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹溾攢鈹€ EnvironmentMonitor/ # 鐜鐩戞帶缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬鍐滀笟缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ processing/    # 鍔犲伐鐩稿叧缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ ProcessingRecordView.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勫姞宸ヨ褰曡鍥剧粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js           # 鍔犲伐妯″潡缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  锟?  锟?  鈹溾攢鈹€ QualityTest/       # 璐ㄩ噺妫€娴嬬粍浠讹紙浼犵粺锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ ProcessingRecord/  # 鍔犲伐璁板綍缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬鍔犲伐缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ logistics/     # 鐗╂祦鐩稿叧缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ LogisticsRecordView.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勭墿娴佽褰曡鍥剧粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js           # 鐗╂祦妯″潡缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  锟?  锟?  鈹溾攢鈹€ ShipmentTracker/   # 杩愯緭璺熻釜缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹溾攢鈹€ RouteMap/          # 璺嚎鍦板浘缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬鐗╂祦缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ admin/         # 绠＄悊鍚庡彴缁勪欢
锟?  锟?  锟?  锟?  鈹溾攢鈹€ AdminDashboard.jsx # 鐜颁唬鍖朢eact鐗堟湰鐨勭鐞嗗憳浠〃鏉跨粍锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ index.js           # 绠＄悊鍛樻ā鍧楃粍浠跺鍑虹储锟?锟?  锟?  锟?  锟?  鈹溾攢鈹€ UserManagement/    # 鐢ㄦ埛绠＄悊缁勪欢锛堜紶缁燂級
锟?  锟?  锟?  锟?  鈹溾攢鈹€ Dashboard/         # 浠〃鐩樼粍浠讹紙浼犵粺锟?锟?  锟?  锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬绠＄悊缁勪欢
锟?  锟?  锟?  鈹斺攢鈹€ profile/       # 鐢ㄦ埛妗ｆ鐩稿叧缁勪欢
锟?  锟?  锟?      鈹溾攢鈹€ UserProfile.jsx   # 鐜颁唬鍖朢eact鐗堟湰鐨勭敤鎴锋。妗堢粍锟?锟?  锟?  锟?      鈹溾攢鈹€ index.js           # 鐢ㄦ埛妗ｆ妯″潡缁勪欢瀵煎嚭绱㈠紩
锟?  锟?  锟?      鈹斺攢鈹€ ...                # 鍏朵粬鐢ㄦ埛妗ｆ缁勪欢
锟?  锟?  鈹斺攢鈹€ ui/                # UI鍩虹缁勪欢
锟?  锟?      鈹溾攢鈹€ Button.js      # 鏍囧噯鍖栨寜閽粍锟?锟?  锟?      鈹溾攢鈹€ Card.js        # 鍗＄墖缁勪欢
锟?  锟?      鈹溾攢鈹€ Loading.js     # 鍔犺浇鐘舵€佺粍锟?锟?  锟?      鈹溾攢鈹€ Modal.js       # 妯℃€佹缁勪欢
锟?  锟?      鈹溾攢鈹€ form/          # 琛ㄥ崟缁勪欢
锟?  锟?      锟?  鈹溾攢鈹€ Input.js   # 杈撳叆妗嗙粍锟?锟?  锟?      锟?  鈹溾攢鈹€ Select.js  # 閫夋嫨妗嗙粍锟?锟?  锟?      锟?  鈹斺攢鈹€ index.js   # 琛ㄥ崟缁勪欢瀵煎嚭
锟?  锟?      鈹溾攢鈹€ navigation/    # 瀵艰埅缁勪欢
锟?  锟?      锟?  鈹溾攢鈹€ MobileNav.js # 绉诲姩绔鑸粍锟?锟?  锟?      锟?  鈹溾攢鈹€ MobileDrawer.js # 绉诲姩绔鑸娊灞夌粍锟?锟?  锟?      锟?  鈹斺攢鈹€ index.js   # 瀵艰埅缁勪欢瀵煎嚭
锟?  锟?      鈹溾攢鈹€ TouchGesture.js # 瑙︽懜鎵嬪娍鏀寔缁勪欢
锟?  锟?      鈹溾攢鈹€ MobileSearch.js # 绉诲姩绔悳绱㈢粍锟?锟?  锟?      鈹溾攢鈹€ layout/        # 甯冨眬缁勪欢
锟?  锟?      锟?  鈹溾攢鈹€ FluidContainer.js  # 鍝嶅簲寮忔祦寮忓竷灞€瀹瑰櫒
锟?  锟?      锟?  鈹溾攢鈹€ Row.js             # 鍝嶅簲寮忚甯冨眬
锟?  锟?      锟?  鈹溾攢鈹€ Column.js          # 鍝嶅簲寮忓垪甯冨眬
锟?  锟?      锟?  鈹溾攢鈹€ PageLayout.js      # 椤甸潰甯冨眬缁勪欢
锟?  锟?      锟?  鈹斺攢鈹€ index.js           # 甯冨眬缁勪欢瀵煎嚭
锟?  锟?      鈹溾攢鈹€ icons/         # 鍥炬爣缁勪欢
锟?  锟?      鈹溾攢鈹€ theme/         # 涓婚缁勪欢
锟?  锟?      鈹斺攢鈹€ index.js       # UI缁勪欢缁熶竴瀵煎嚭
锟?  鈹溾攢鈹€ pages/                 # 椤甸潰缁勪欢
锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉鐩稿叧椤甸潰
锟?  锟?  锟?  鈹溾攢鈹€ LoginPage.jsx  # 鐧诲綍椤甸潰
锟?  锟?  锟?  鈹溾攢鈹€ RegisterPage.jsx # 娉ㄥ唽椤甸潰
锟?  锟?  锟?  鈹斺攢鈹€ ...            # 鍏朵粬璁よ瘉椤甸潰
锟?  锟?  鈹溾攢鈹€ trace/             # 婧簮鐩稿叧椤甸潰
锟?  锟?  锟?  鈹溾攢鈹€ TracePage.jsx  # 婧簮鏌ヨ椤甸潰
锟?  锟?  锟?  鈹溾攢鈹€ TraceDetailPage.jsx # 婧簮璇︽儏椤甸潰
锟?  锟?  锟?  鈹斺攢鈹€ ...            # 鍏朵粬婧簮椤甸潰
锟?  锟?  鈹溾攢鈹€ farming/           # 鍐滀笟/鍏绘畺鐩稿叧椤甸潰
锟?  锟?  鈹溾攢鈹€ processing/        # 鍔犲伐鐩稿叧椤甸潰
锟?  锟?  鈹溾攢鈹€ logistics/         # 鐗╂祦鐩稿叧椤甸潰
锟?  锟?  鈹溾攢鈹€ admin/             # 绠＄悊鍚庡彴椤甸潰
锟?  锟?  鈹斺攢鈹€ error/             # 閿欒椤甸潰
锟?  锟?      鈹溾攢鈹€ NotFoundPage.jsx # 404椤甸潰
锟?  锟?      鈹斺攢鈹€ ErrorPage.jsx  # 閫氱敤閿欒椤甸潰
锟?  鈹溾攢鈹€ hooks/                 # 鑷畾涔塇ooks
锟?  锟?  鈹溾攢鈹€ useAuth.js         # 璁よ瘉Hook
锟?  锟?  鈹溾攢鈹€ useTrace.js        # 婧簮Hook
锟?  锟?  鈹溾攢鈹€ useForm.js         # 琛ㄥ崟Hook
锟?  锟?  鈹斺攢鈹€ ...                # 鍏朵粬鑷畾涔塇ook
锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿鍑芥暟
锟?  锟?  鈹溾攢鈹€ network/           # 缃戠粶鐩稿叧宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ api.js         # API璇锋眰宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ interceptors.js # 璇锋眰鎷︽埅锟?锟?  锟?  锟?  鈹斺攢鈹€ errorHandler.js # 閿欒澶勭悊
锟?  锟?  鈹溾攢鈹€ storage/           # 瀛樺偍鐩稿叧宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ localStorage.js # 鏈湴瀛樺偍宸ュ叿
锟?  锟?  锟?  鈹斺攢鈹€ sessionStorage.js # 浼氳瘽瀛樺偍宸ュ叿
锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉鐩稿叧宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ token.js       # 浠ょ墝绠＄悊
锟?  锟?  锟?  鈹斺攢鈹€ permissions.js # 鏉冮檺妫€锟?锟?  锟?  鈹溾攢鈹€ performance/       # 鎬ц兘鐩戞帶鐩稿叧宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ performance-tracker.js  # 鎬ц兘杩借釜宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ resource-monitor.js     # 璧勬簮鐩戞帶宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ performance-test-tool.js # 鎬ц兘娴嬭瘯宸ュ叿
锟?  锟?  锟?  鈹斺攢鈹€ index.js               # 鎬ц兘宸ュ叿缁熶竴瀵煎嚭
锟?  锟?  鈹溾攢鈹€ common/            # 閫氱敤宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ date.js        # 鏃ユ湡澶勭悊
锟?  锟?  锟?  鈹溾攢鈹€ format.js      # 鏍煎紡鍖栧伐锟?锟?  锟?  锟?  鈹溾攢鈹€ validation.js  # 楠岃瘉宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ responsive-helper.js # 鍝嶅簲寮忓竷灞€杈呭姪宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ media-query-manager.js # 濯掍綋鏌ヨ绠＄悊绯荤粺
锟?  锟?  锟?  鈹溾攢鈹€ event-emitter.js     # 浜嬩欢瑙﹀彂锟?锟?  锟?  锟?  鈹溾攢鈹€ logger.js            # 鏃ュ織宸ュ叿
锟?  锟?  锟?  鈹溾攢鈹€ Lock.js              # 閿佹満鍒跺伐锟?锟?  锟?  锟?  鈹溾攢鈹€ config-loader.js     # 閰嶇疆鍔犺浇鍣紙宸叉ā鍧楀寲锟?锟?  锟?  锟?  鈹斺攢鈹€ index.js             # 閫氱敤宸ュ叿缁熶竴瀵煎嚭
锟?  锟?  鈹斺攢鈹€ index.js           # 宸ュ叿鍑芥暟鎬诲鍑哄叆锟?锟?  鈹溾攢鈹€ services/              # API鏈嶅姟
锟?  锟?  鈹溾攢鈹€ trace/             # 婧簮鐩稿叧API
锟?  锟?  锟?  鈹溾攢鈹€ traceService.js # 婧簮鏈嶅姟
锟?  锟?  锟?  鈹斺攢鈹€ eventService.js # 浜嬩欢鏈嶅姟
锟?  锟?  鈹溾攢鈹€ farming/           # 鍐滀笟/鍏绘畺鐩稿叧API
锟?  锟?  鈹溾攢鈹€ processing/        # 鍔犲伐鐩稿叧API
锟?  锟?  鈹溾攢鈹€ logistics/         # 鐗╂祦鐩稿叧API
锟?  锟?  鈹斺攢鈹€ auth/              # 璁よ瘉鐩稿叧API
锟?  锟?      鈹溾攢鈹€ authService.js # 璁よ瘉鏈嶅姟
锟?  锟?      鈹斺攢鈹€ userService.js # 鐢ㄦ埛鏈嶅姟
锟?  鈹溾攢鈹€ store/                 # 鐘舵€佺锟?锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉鐘讹拷?锟?  锟?  鈹溾攢鈹€ trace/             # 婧簮鐘讹拷?锟?  锟?  鈹溾攢鈹€ ui/                # UI鐘讹拷?锟?  锟?  鈹斺攢鈹€ index.js           # 鐘舵€佺鐞嗗叆锟?锟?  鈹溾攢鈹€ styles/                # 鍏ㄥ眬鏍峰紡
锟?  锟?  鈹溾攢鈹€ themes/            # 涓婚鏍峰紡
锟?  锟?  锟?  鈹溾攢鈹€ light.css      # 浜壊涓婚
锟?  锟?  锟?  鈹斺攢鈹€ dark.css       # 鏆楄壊涓婚
锟?  锟?  鈹溾攢鈹€ components/        # 缁勪欢鏍峰紡
锟?  锟?  鈹溾攢鈹€ pages/             # 椤甸潰鏍峰紡
锟?  锟?  鈹斺攢鈹€ globals/           # 鍏ㄥ眬鏍峰紡
锟?  锟?      鈹溾攢鈹€ variables.css  # CSS鍙橀噺
锟?  锟?      鈹溾攢鈹€ reset.css      # CSS閲嶇疆
锟?  锟?      鈹溾攢鈹€ typography.css # 鎺掔増鏍峰紡
锟?  锟?      鈹斺攢鈹€ responsive.css # 鍝嶅簲寮忔牱锟?锟?  鈹斺攢鈹€ types/                 # 绫诲瀷瀹氫箟
锟?      鈹溾攢鈹€ trace.d.ts         # 婧簮绫诲瀷
锟?      鈹溾攢鈹€ auth.d.ts          # 璁よ瘉绫诲瀷
锟?      鈹斺攢鈹€ ...                # 鍏朵粬绫诲瀷瀹氫箟
鈹溾攢鈹€ public/                    # 闈欐€佽祫锟?锟?  鈹溾攢鈹€ assets/                # 璧勬簮鏂囦欢
锟?  锟?  鈹溾攢鈹€ images/            # 鍥剧墖璧勬簮
锟?  锟?  鈹溾攢鈹€ icons/             # 鍥炬爣璧勬簮
锟?  锟?  鈹斺攢鈹€ logos/             # Logo璧勬簮
锟?  鈹溾攢鈹€ fonts/                 # 瀛椾綋鏂囦欢
锟?  鈹溾攢鈹€ favicon.ico            # 缃戠珯鍥炬爣
锟?  鈹斺攢鈹€ index.html             # HTML妯℃澘
鈹溾攢鈹€ dist/                      # 鏋勫缓杈撳嚭鐩綍
锟?  鈹溾攢鈹€ bundle.js              # 鎵撳寘鍚庣殑JavaScript鏂囦欢
锟?  鈹溾攢鈹€ *.js                   # 鍏朵粬鐢熸垚鐨凧S鏂囦欢
锟?  鈹斺攢鈹€ assets/                # 鎵撳寘鍚庣殑璧勬簮鏂囦欢
鈹溾攢鈹€ js/                        # JavaScript鏂囦欢鐩綍
鈹溾攢鈹€ static/                    # 闈欐€佽祫婧愮洰锟?锟?  鈹溾攢鈹€ css/                   # CSS鏍峰紡鏂囦欢
锟?  鈹溾攢鈹€ images/                # 鍥剧墖璧勬簮
锟?  鈹斺攢鈹€ js/                    # JavaScript鏂囦欢
鈹溾攢鈹€ styles/                    # 鏍峰紡鏂囦欢鐩綍
鈹溾攢鈹€ assets/                    # 璧勬簮鏂囦欢鐩綍
锟?  鈹溾攢鈹€ components/            # 缁勪欢鐩稿叧璧勬簮
锟?  鈹溾攢鈹€ css/                   # CSS鏍峰紡鏂囦欢
锟?  鈹溾攢鈹€ icons/                 # 鍥炬爣璧勬簮
锟?  锟?  鈹溾攢鈹€ home/              # 棣栭〉鍥炬爣
锟?  锟?  鈹溾攢鈹€ info/              # 淇℃伅鍥炬爣
锟?  锟?  鈹溾攢鈹€ record/            # 璁板綍鍥炬爣
锟?  锟?  鈹斺攢鈹€ user/              # 鐢ㄦ埛鍥炬爣
锟?  鈹溾攢鈹€ images/                # 鍥剧墖璧勬簮
锟?  鈹溾攢鈹€ monitoring/            # 鐩戞帶鐩稿叧璧勬簮
锟?  锟?  鈹斺攢鈹€ thumbnails/        # 缂╃暐锟?锟?  鈹斺攢鈹€ styles/                # 鏍峰紡璧勬簮
鈹溾攢鈹€ pages/                     # 椤甸潰鏂囦欢鐩綍 (26涓牳蹇冮潤鎬侀〉锟?+ 棰勮绯荤粺)
锟?  鈹溾攢鈹€ index.html             # 馃幆 椤甸潰棰勮绯荤粺 - 浣跨敤iframe灞曠ず鎵€鏈夐〉闈㈢殑涓诲睍绀洪〉锟?锟?  鈹溾攢鈹€ product-trace.html     # 浜у搧婧簮鏌ヨ涓婚〉 (740锟? 21KB)
锟?  鈹溾攢鈹€ coming-soon.html       # 鍗冲皢涓婄嚎椤甸潰 (125锟? 6KB)
锟?  鈹溾攢鈹€ _template.html         # 椤甸潰妯℃澘 (82锟? 2.9KB)
锟?  鈹溾攢鈹€ admin/                 # 绠＄悊鍚庡彴椤甸潰 (6涓〉锟?
锟?  锟?  鈹溾攢鈹€ assets/            # 绠＄悊鍚庡彴璧勬簮
锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉鐩稿叧椤甸潰
锟?  锟?  锟?  鈹斺攢鈹€ login.html     # 绠＄悊鍛樼櫥褰曢〉锟?锟?  锟?  鈹溾攢鈹€ admin-dashboard.html # 绠＄悊鍛樻帶鍒跺彴
锟?  锟?  鈹溾攢鈹€ data-import.html   # 鏁版嵁瀵煎叆椤甸潰
锟?  锟?  鈹溾攢鈹€ user-management.html # 鐢ㄦ埛绠＄悊椤甸潰
锟?  锟?  鈹溾攢鈹€ system-logs.html   # 绯荤粺鏃ュ織椤甸潰
锟?  锟?  鈹溾攢鈹€ template.html      # 妯℃澘閰嶇疆锟?锟?  锟?  鈹溾攢鈹€ components/        # 绠＄悊鍚庡彴缁勪欢
锟?  锟?  鈹斺攢鈹€ errors/            # 閿欒椤甸潰
锟?  鈹溾攢鈹€ assets/                # 椤甸潰璧勬簮
锟?  锟?  鈹溾攢鈹€ css/               # 椤甸潰CSS
锟?  锟?  鈹斺攢鈹€ icons/             # 椤甸潰鍥炬爣
锟?  鈹溾攢鈹€ auth/                  # 璁よ瘉椤甸潰 (1涓〉锟?
锟?  锟?  鈹斺攢鈹€ login.html         # 鐢ㄦ埛鐧诲綍椤甸潰 (705锟? 26KB)
锟?  鈹溾攢鈹€ demo/                  # 婕旂ず椤甸潰
锟?  鈹溾攢鈹€ errors/                # 閿欒椤甸潰
锟?  鈹溾攢鈹€ farming/               # 鍐滀笟椤甸潰 (5涓〉锟?
锟?  锟?  鈹溾攢鈹€ create-trace.html  # 鍒涘缓婧簮璁板綍
锟?  锟?  鈹溾攢鈹€ farming-vaccine.html # 鐤嫍褰曞叆
锟?  锟?  鈹溾攢鈹€ farming-breeding.html # 绻佽偛淇℃伅绠＄悊
锟?  锟?  鈹溾攢鈹€ farming-monitor.html # 鍦哄湴瑙嗛鐩戞帶
锟?  锟?  鈹斺攢鈹€ assets/            # 鍐滀笟椤甸潰璧勬簮
锟?  锟?      鈹斺攢鈹€ images/        # 鍐滀笟椤甸潰鍥剧墖
锟?  鈹溾攢鈹€ home/                  # 棣栭〉妯″潡 (4涓〉锟?
锟?  锟?  鈹溾攢鈹€ home-selector.html # 鍔熻兘妯″潡閫夋嫨锟?(883锟? 34KB)
锟?  锟?  鈹溾攢鈹€ home-farming.html  # 鍏绘畺绠＄悊棣栭〉
锟?  锟?  鈹溾攢鈹€ home-processing.html # 鐢熶骇鍔犲伐棣栭〉
锟?  锟?  鈹斺攢鈹€ home-logistics.html # 閿€鍞墿娴侀锟?锟?  鈹溾攢鈹€ logistics/             # 鐗╂祦椤甸潰
锟?  鈹溾攢鈹€ page-assets/           # 椤甸潰璧勬簮
锟?  锟?  鈹斺攢鈹€ icons/             # 椤甸潰鍥炬爣
锟?  鈹溾攢鈹€ pages/                 # 椤甸潰瀛愮洰锟?锟?  锟?  鈹斺攢鈹€ errors/            # 閿欒椤甸潰
锟?  鈹溾攢鈹€ processing/            # 鍔犲伐椤甸潰 (3涓〉锟?
锟?  锟?  鈹溾攢鈹€ processing-reports.html # 璐ㄦ鎶ュ憡鏌ヨ
锟?  锟?  鈹溾攢鈹€ processing-quality.html # 鑲夎川绛夌骇璇勫畾
锟?  锟?  鈹溾攢鈹€ processing-photos.html # 鍔犲伐鎷嶇収
锟?  锟?  鈹斺攢鈹€ assets/            # 鍔犲伐椤甸潰璧勬簮
锟?  鈹溾攢鈹€ profile/               # 鐢ㄦ埛璧勬枡椤甸潰 (3涓〉锟?
锟?  锟?  鈹溾攢鈹€ profile.html       # 涓汉涓績
锟?  锟?  鈹溾攢鈹€ settings.html      # 绯荤粺璁剧疆
锟?  锟?  鈹斺攢鈹€ help-center.html   # 甯姪涓績
锟?  鈹斺攢鈹€ trace/                 # 婧簮椤甸潰 (6涓〉锟?
锟?      鈹溾攢鈹€ trace-query.html   # 婧簮鏌ヨ (523锟? 25KB)
锟?      鈹溾攢鈹€ trace-detail.html  # 婧簮璇︽儏锟?(572锟? 34KB)
锟?      鈹溾攢鈹€ trace-list.html    # 婧簮鍒楄〃 (470锟? 22KB)
锟?      鈹溾攢鈹€ trace-certificate.html # 婧簮璇佷功 (343锟? 15KB)
锟?  锟?  鈹溾攢鈹€ trace-edit.html    # 婧簮璁板綍缂栬緫 (229锟? 12KB)
锟?  锟?  鈹斺攢鈹€ trace-map.html     # 鍦板浘灞曠ず (310锟? 15KB)
锟?  鈹溾攢鈹€ components/                # 缁勪欢鐩綍
锟?  锟?  鈹溾攢鈹€ auth/                  # 璁よ瘉缁勪欢
锟?  锟?  鈹溾攢鈹€ data/                  # 鏁版嵁缁勪欢
锟?  锟?  鈹溾攢鈹€ documentation/         # 鏂囨。缁勪欢
锟?  锟?  鈹溾攢鈹€ modules/               # 妯″潡缁勪欢
锟?  锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉妯″潡
锟?  锟?  锟?  鈹溾攢鈹€ data/              # 鏁版嵁妯″潡
锟?  锟?  锟?  鈹溾攢鈹€ store/             # 瀛樺偍妯″潡
锟?  锟?  锟?  鈹溾攢鈹€ trace/             # 婧簮妯″潡
锟?  锟?  锟?  鈹溾攢鈹€ ui/                # UI妯″潡
锟?  锟?  锟?  鈹溾攢鈹€ utils/             # 宸ュ叿妯″潡
锟?  锟?  锟?  鈹斺攢鈹€ web-app/           # Web搴旂敤妯″潡
锟?  锟?  锟?  鈹斺攢鈹€ test-pages/    # 娴嬭瘯椤甸潰
锟?  锟?  鈹溾攢鈹€ store/                 # 瀛樺偍缁勪欢
锟?  锟?  鈹溾攢鈹€ ui/                    # UI缁勪欢
锟?  锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿缁勪欢
锟?  锟?  鈹斺攢鈹€ validation/            # 楠岃瘉缁勪欢
锟?  锟?      鈹斺攢鈹€ screenshots/       # 楠岃瘉鎴浘
锟?  鈹溾攢鈹€ store/                 # 瀛樺偍缁勪欢
锟?  鈹溾攢鈹€ ui/                    # UI缁勪欢
锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿缁勪欢
锟?  鈹斺攢鈹€ validation/            # 楠岃瘉缁勪欢
锟?      鈹斺攢鈹€ screenshots/       # 楠岃瘉鎴浘
鈹溾攢鈹€ coverage/                  # 娴嬭瘯瑕嗙洊鐜囨姤锟?锟?  鈹溾攢鈹€ auth/                  # 璁よ瘉妯″潡瑕嗙洊锟?锟?  鈹溾攢鈹€ data/                  # 鏁版嵁妯″潡瑕嗙洊锟?锟?  鈹溾攢鈹€ lcov-report/           # LCOV鏍煎紡鎶ュ憡
锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉妯″潡鎶ュ憡
锟?  锟?  鈹溾攢鈹€ components/        # 缁勪欢鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ data/          # 鏁版嵁缁勪欢鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ modules/       # 妯″潡缁勪欢鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ auth/      # 璁よ瘉妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ data/      # 鏁版嵁妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ store/     # 瀛樺偍妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ trace/     # 婧簮妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ ui/        # UI妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹斺攢鈹€ utils/     # 宸ュ叿妯″潡鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ store/         # 瀛樺偍缁勪欢鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ ui/            # UI缁勪欢鎶ュ憡
锟?  锟?  锟?  鈹斺攢鈹€ utils/         # 宸ュ叿缁勪欢鎶ュ憡
锟?  锟?  鈹溾攢鈹€ data/              # 鏁版嵁鎶ュ憡
锟?  锟?  鈹溾攢鈹€ modules/           # 妯″潡鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ auth/          # 璁よ瘉妯″潡鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ data/          # 鏁版嵁妯″潡鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ store/         # 瀛樺偍妯″潡鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ ui/            # UI妯″潡鎶ュ憡
锟?  锟?  锟?  鈹斺攢鈹€ utils/         # 宸ュ叿妯″潡鎶ュ憡
锟?  锟?  鈹溾攢鈹€ src/               # 婧愪唬鐮佽鐩栫巼鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ auth/          # 璁よ瘉婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ compatibility/ # 鍏煎鎬ф簮鐮佹姤锟?锟?  锟?  锟?  锟?  鈹斺攢鈹€ polyfills/ # Polyfills鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ components/    # 缁勪欢婧愮爜鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ common/    # 閫氱敤缁勪欢鎶ュ憡
锟?  锟?  锟?  锟?  鈹溾攢鈹€ modules/   # 妯″潡缁勪欢鎶ュ憡
锟?  锟?  锟?  锟?  锟?  鈹溾攢鈹€ farming/ # 鍐滀笟妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  锟?  鈹斺攢鈹€ trace/ # 婧簮妯″潡鎶ュ憡
锟?  锟?  锟?  锟?  鈹斺攢鈹€ ui/        # UI缁勪欢鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ examples/      # 绀轰緥婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ network/       # 缃戠粶婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ performance-tracking/ # 鎬ц兘杩借釜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ security/      # 瀹夊叏婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ storage/       # 瀛樺偍婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹溾攢鈹€ tools/         # 宸ュ叿婧愮爜鎶ュ憡
锟?  锟?  锟?  鈹斺攢鈹€ utils/         # 宸ュ叿鍑芥暟鎶ュ憡
锟?  锟?  锟?      鈹溾攢鈹€ auth/      # 璁よ瘉宸ュ叿鎶ュ憡
锟?  锟?  锟?      鈹溾攢鈹€ common/    # 閫氱敤宸ュ叿鎶ュ憡
锟?  锟?  锟?      鈹溾攢鈹€ network/   # 缃戠粶宸ュ叿鎶ュ憡
锟?  锟?  锟?      鈹斺攢鈹€ storage/   # 瀛樺偍宸ュ叿鎶ュ憡
锟?  锟?  鈹溾攢鈹€ store/             # 瀛樺偍鎶ュ憡
锟?  锟?  鈹溾攢鈹€ ui/                # UI鎶ュ憡
锟?  锟?  鈹溾攢鈹€ utils/             # 宸ュ叿鎶ュ憡
锟?  锟?  鈹斺攢鈹€ web-app/           # Web搴旂敤鎶ュ憡
锟?  锟?      鈹斺攢鈹€ components/    # Web搴旂敤缁勪欢鎶ュ憡
锟?  锟?          鈹斺攢鈹€ modules/   # Web搴旂敤妯″潡鎶ュ憡
锟?  锟?              鈹溾攢鈹€ auth/  # 璁よ瘉妯″潡鎶ュ憡
锟?  锟?              鈹溾攢鈹€ data/  # 鏁版嵁妯″潡鎶ュ憡
锟?  锟?              鈹溾攢鈹€ store/ # 瀛樺偍妯″潡鎶ュ憡
锟?  锟?              鈹溾攢鈹€ trace/ # 婧簮妯″潡鎶ュ憡
锟?  锟?              鈹溾攢鈹€ ui/    # UI妯″潡鎶ュ憡
锟?  锟?              鈹斺攢鈹€ utils/ # 宸ュ叿妯″潡鎶ュ憡
锟?  鈹溾攢鈹€ modules/               # 妯″潡瑕嗙洊锟?锟?  锟?  鈹溾攢鈹€ auth/              # 璁よ瘉妯″潡
锟?  锟?  鈹溾攢鈹€ data/              # 鏁版嵁妯″潡
锟?  锟?  鈹溾攢鈹€ store/             # 瀛樺偍妯″潡
锟?  锟?  鈹溾攢鈹€ ui/                # UI妯″潡
锟?  锟?  鈹斺攢鈹€ utils/             # 宸ュ叿妯″潡
锟?  鈹溾攢鈹€ store/                 # 瀛樺偍瑕嗙洊锟?锟?  鈹溾攢鈹€ ui/                    # UI瑕嗙洊锟?锟?  鈹溾攢鈹€ utils/                 # 宸ュ叿瑕嗙洊锟?锟?  鈹斺攢鈹€ web-app/               # Web搴旂敤瑕嗙洊锟?锟?      鈹斺攢鈹€ components/        # Web搴旂敤缁勪欢瑕嗙洊锟?锟?          鈹斺攢鈹€ modules/       # Web搴旂敤妯″潡瑕嗙洊锟?锟?              鈹溾攢鈹€ auth/      # 璁よ瘉妯″潡瑕嗙洊锟?锟?              鈹溾攢鈹€ data/      # 鏁版嵁妯″潡瑕嗙洊锟?锟?              鈹溾攢鈹€ store/     # 瀛樺偍妯″潡瑕嗙洊锟?锟?              鈹溾攢鈹€ trace/     # 婧簮妯″潡瑕嗙洊锟?锟?              鈹溾攢鈹€ ui/        # UI妯″潡瑕嗙洊锟?锟?              鈹斺攢鈹€ utils/     # 宸ュ叿妯″潡瑕嗙洊锟?鈹溾攢鈹€ logs/                      # 鏃ュ織鏂囦欢鐩綍
鈹溾攢鈹€ screenshots/               # 鎴浘鐩綍
鈹溾攢鈹€ tmp/                       # 涓存椂鏂囦欢鐩綍
鈹溾攢鈹€ web-app/                   # Web搴旂敤瀛愮洰锟?锟?  鈹斺攢鈹€ coverage/              # Web搴旂敤瑕嗙洊鐜囨姤锟?锟?      鈹斺攢鈹€ lcov-report/       # LCOV鏍煎紡鎶ュ憡
鈹溾攢鈹€ .github/                   # GitHub閰嶇疆
锟?  鈹斺攢鈹€ workflows/             # GitHub Actions宸ヤ綔锟?鈹斺攢鈹€ .husky/                    # Git閽╁瓙閰嶇疆
鈹溾攢鈹€ tests/                     # 娴嬭瘯鏂囦欢
锟?  鈹溾攢鈹€ e2e/                   # 绔埌绔祴锟?锟?  锟?  鈹溾攢鈹€ global-setup.js    # 鍏ㄥ眬娴嬭瘯璁剧疆
锟?  锟?  鈹斺攢鈹€ *.test.js          # 绔埌绔祴璇曠敤锟?锟?  鈹溾攢鈹€ integration/           # 闆嗘垚娴嬭瘯
锟?  锟?  鈹溾攢鈹€ mock-server/       # 妯℃嫙鏈嶅姟锟?锟?  锟?  锟?  鈹溾攢鈹€ index.js       # 妯℃嫙鏈嶅姟鍣ㄥ疄锟?锟?  锟?  锟?  鈹溾攢鈹€ mockFetch.js   # Fetch璇锋眰妯℃嫙宸ュ叿
锟?  锟?  锟?  鈹斺攢鈹€ static/        # 闈欐€佽祫婧愮洰锟?锟?  锟?  鈹斺攢鈹€ *.test.js          # 闆嗘垚娴嬭瘯鐢ㄤ緥
锟?  鈹溾攢鈹€ unit/                  # 鍗曞厓娴嬭瘯
锟?  锟?  鈹溾攢鈹€ utils/             # 宸ュ叿鍑芥暟鍗曞厓娴嬭瘯
锟?  锟?  鈹斺攢鈹€ *.test.js          # 鍗曞厓娴嬭瘯鐢ㄤ緥
锟?  鈹溾攢鈹€ utils/                 # 娴嬭瘯宸ュ叿
锟?  锟?  鈹溾攢鈹€ fileMock.js        # 鏂囦欢妯℃嫙
锟?  锟?  鈹溾攢鈹€ styleMock.js       # 鏍峰紡妯℃嫙
锟?  锟?  鈹斺攢鈹€ test-environment-mocks.js # 娴嬭瘯鐜妯℃嫙
锟?  鈹溾攢鈹€ setup.js               # 娴嬭瘯鐜璁剧疆
锟?  鈹溾攢鈹€ run-all-tests.js       # 娴嬭瘯杩愯鑴氭湰
锟?  鈹斺攢鈹€ README.md              # 娴嬭瘯浣跨敤鎸囧崡
鈹溾攢鈹€ config/                    # 閰嶇疆鏂囦欢
锟?  鈹溾攢鈹€ default/               # 榛樿閰嶇疆
锟?  锟?  鈹溾攢鈹€ app.js             # 搴旂敤鍩烘湰閰嶇疆
锟?  锟?  鈹溾攢鈹€ api.js             # API鐩稿叧閰嶇疆
锟?  锟?  鈹溾攢鈹€ auth.js            # 璁よ瘉鐩稿叧閰嶇疆
锟?  锟?  鈹溾攢鈹€ ui.js              # UI鐩稿叧閰嶇疆
锟?  锟?  鈹溾攢鈹€ features.js        # 鍔熻兘鐗规€ч厤锟?锟?  锟?  鈹溾攢鈹€ storage.js         # 瀛樺偍鐩稿叧閰嶇疆
锟?  锟?  鈹溾攢鈹€ performance.js     # 鎬ц兘鐩稿叧閰嶇疆
锟?  锟?  鈹斺攢鈹€ integration.js     # 绗笁鏂归泦鎴愰厤锟?锟?  鈹溾攢鈹€ environments/          # 鐜鐗瑰畾閰嶇疆
锟?  锟?  鈹溾攢鈹€ development.js     # 寮€鍙戠幆澧冮厤锟?锟?  锟?  鈹溾攢鈹€ testing.js         # 娴嬭瘯鐜閰嶇疆
锟?  锟?  鈹斺攢鈹€ production.js      # 鐢熶骇鐜閰嶇疆
锟?  鈹溾攢鈹€ server/                # 鏈嶅姟鍣ㄩ厤锟?锟?  锟?  鈹溾攢鈹€ default.js         # 榛樿鏈嶅姟鍣ㄩ厤锟?锟?  锟?  鈹溾攢鈹€ development.js     # 寮€鍙戠幆澧冩湇鍔″櫒閰嶇疆
锟?  锟?  鈹溾攢鈹€ testing.js         # 娴嬭瘯鐜鏈嶅姟鍣ㄩ厤锟?锟?  锟?  鈹斺攢鈹€ production.js      # 鐢熶骇鐜鏈嶅姟鍣ㄩ厤锟?锟?  鈹溾攢鈹€ build/                 # 鏋勫缓閰嶇疆
锟?  锟?  鈹溾攢鈹€ webpack.config.js  # Webpack鏋勫缓閰嶇疆
锟?  锟?  鈹溾攢鈹€ babel.config.js    # Babel閰嶇疆
锟?  锟?  鈹斺攢鈹€ postcss.config.js  # PostCSS閰嶇疆
锟?  鈹溾攢鈹€ test/                  # 娴嬭瘯閰嶇疆
锟?  锟?  鈹溾攢鈹€ jest.config.js     # Jest涓婚厤锟?锟?  锟?  鈹溾攢鈹€ jest.setup.js      # Jest璁剧疆鏂囦欢
锟?  锟?  鈹斺攢鈹€ playwright.config.js # Playwright绔埌绔祴璇曢厤锟?锟?  鈹斺攢鈹€ assets.js              # 璧勬簮绠＄悊閰嶇疆
鈹斺攢鈹€ .browserslistrc            # 娴忚鍣ㄦ敮鎸佸垪锟?```

## 3. 鐩綍缁撴瀯璇存槑

### 3.1 鏍圭洰褰曟枃浠朵笌鐩綍璇存槑

| 鐩綍/鏂囦欢 | 璇存槑 |
|---------|------|
| `web-app/` | 鍖呭惈Web搴旂敤鐨勬墍鏈夋簮浠ｇ爜銆佽祫婧愬拰閰嶇疆锛屾槸椤圭洰鐨勬牳蹇冨紑鍙戠洰褰曪拷?|
| `docs/` | 鍖呭惈椤圭洰鎵€鏈夋枃妗ｏ紝鎸夌被鍨嬶紙鏋舵瀯銆丄PI銆佺粍浠躲€佹寚鍗椼€丳RD銆侀」鐩鐞嗭級鍒嗙被缁勭粐銆傛彁渚涘紑鍙戣€呯悊瑙ｇ郴缁熺殑閲嶈璧勬簮锟?|
| `scripts/` | 鍖呭惈鐢ㄤ簬寮€鍙戙€佹瀯寤哄拰閮ㄧ讲鐨勫伐鍏疯剼鏈€傝繖浜涜剼鏈嚜鍔ㄥ寲甯歌浠诲姟锛屾彁楂樺紑鍙戞晥鐜囷拷?|
| `refactor/` | 鍖呭惈椤圭洰閲嶆瀯鐨勮鍒掋€佷换鍔″拰缁撴灉鏂囨。銆傝褰曢噸鏋勮繃绋嬪拰鎴愭灉锛屼究浜庤拷韪噸鏋勮繘搴︺€傚綋鍓嶆鍦ㄨ繘琛岄樁娈典簩(浠ｇ爜浼樺寲涓庢ā鍧楀寲)锟?|
| `.cursor/` | 鍖呭惈Cursor AI缂栬緫鍣ㄧ殑瑙勫垯閰嶇疆锛屽畾涔変簡寮€鍙戝師鍒欍€侀」鐩鐞嗚鑼冦€佷换鍔＄鐞嗚鑼冪瓑锛岀‘淇滱I杈呭姪寮€鍙戠殑涓€鑷存€у拰璐ㄩ噺锟?|
| `.github/` | 鍖呭惈GitHub鐩稿叧閰嶇疆锛屼富瑕佹槸CI/CD宸ヤ綔娴佺▼瀹氫箟锟?|
| `.husky/` | 鍖呭惈Git閽╁瓙閰嶇疆锛岀敤浜庡湪Git鎿嶄綔鍓嶆墽琛屼唬鐮佹鏌ョ瓑浠诲姟锟?|
| `.vscode/` | 鍖呭惈VS Code缂栬緫鍣ㄧ殑椤圭洰鐗瑰畾閰嶇疆锛岀‘淇濆洟闃熶娇鐢ㄤ竴鑷寸殑缂栬緫鍣ㄨ缃拷?|
| `package.json` | 椤圭洰渚濊禆鍜岃剼鏈畾涔夛紝鏄痭pm/yarn/pnpm鍖呯鐞嗙殑鏍稿績鏂囦欢锟?|
| `workspace.json` | 宸ヤ綔鍖洪厤缃枃浠讹紝瀹氫箟椤圭洰宸ヤ綔鍖虹殑缁撴瀯鍜岃缃拷?|
| `vercel.json` | Vercel閮ㄧ讲骞冲彴鐨勯厤缃枃浠讹紝瀹氫箟閮ㄧ讲瑙勫垯鍜岃缃拷?|
| `test-server.js` | 娴嬭瘯鏈嶅姟鍣ㄩ厤缃紝鐢ㄤ簬鏈湴寮€鍙戝拰娴嬭瘯鐜锟?|
| `TASKS.md` | 椤圭洰浠诲姟姒傝锛屾彁渚涢珮绾ф憳瑕佸苟寮曠敤鏉冨▉鏉ユ簮鑾峰彇璇︾粏淇℃伅锟?|
| `閲嶆瀯闃舵璁板綍.md` | 閲嶆瀯闃舵鐨勮缁嗚褰曟枃妗ｏ紝璁板綍鍚勯樁娈电殑杩涘睍鍜屾垚鏋滐拷?|
| `椤圭洰閲嶆瀯鏂规.md` | 椤圭洰閲嶆瀯鐨勬€讳綋鏂规鍜岃鍒掓枃妗ｏ拷?|
| `鎵€鏈夋枃浠惰В锟?md` | 椤圭洰涓墍鏈夋枃浠剁殑璇︾粏瑙ｉ噴鏂囨。锟?|
| `.gitignore` | 鎸囧畾Git搴斿拷鐣ョ殑鏂囦欢鍜岀洰褰曪拷?|
| `README.md` | 椤圭洰涓昏璇存槑鏂囨。锛屾彁渚涢」鐩杩般€佸姛鑳藉拰浣跨敤鎸囧崡锟?|
| `README.md.bak` | README鏂囨。鐨勫浠芥枃浠讹拷?|
| `DIRECTORY_STRUCTURE.md` | 褰撳墠鏂囦欢锛岃缁嗚鏄庨」鐩洰褰曠粨鏋勶拷?|

### 3.2 web-app鐩綍璇存槑

#### 3.2.1 src鐩綍

| 鐩綍 | 璇存槑 |
|------|------|
| `components/` | 鍖呭惈鎵€鏈塕eact缁勪欢锛屽垎涓洪€氱敤缁勪欢銆佷笟鍔℃ā鍧楃粍浠跺拰UI鍩虹缁勪欢涓変釜瀛愮洰褰曘€傚湪閲嶆瀯闃舵浜屼腑锛屼笟鍔℃ā鍧楃粍浠剁粨鏋勫緱鍒颁簡瀹屽杽锛屾柊澧炰簡澶勭悊(processing)銆佺墿锟?logistics)鍜岀鐞嗗悗锟?admin)绛夋ā鍧楃洰褰曪紱鍚屾椂鍦║I鍩虹缁勪欢涓柊澧炰簡鏍囧噯鍖栫粍锟?Button, Card, Input, MobileNav, PageLayout)鍜屽搷搴斿紡甯冨眬缁勪欢(FluidContainer, Row, Column)锛屽缓绔嬩簡瀹屾暣鐨勭Щ鍔ㄧUI閫傞厤妗嗘灦銆傛瘡涓粍浠朵娇鐢ㄧ嫭绔嬬洰褰曠粍缁囷紝鍖呭惈瀹炵幇銆佹牱寮忓拰娴嬭瘯鏂囦欢锟?|
| `pages/` | 鍖呭惈搴旂敤鐨勯〉闈㈢骇缁勪欢锛屾寜鍔熻兘妯″潡缁勭粐銆傛瘡涓〉闈㈢粍浠舵暣鍚堝涓皬缁勪欢锛屽疄鐜板畬鏁翠笟鍔″姛鑳斤拷?|
| `hooks/` | 鍖呭惈鑷畾涔塕eact Hooks锛屽皝瑁呭彲澶嶇敤鐨勯€昏緫锛屽琛ㄥ崟澶勭悊銆佽璇侀€昏緫绛夛拷?|
| `utils/` | 鍖呭惈閫氱敤宸ュ叿鍑芥暟锛屾寜鍔熻兘鍒嗙被锛堢綉缁溿€佸瓨鍌ㄣ€佽璇併€侀€氱敤銆佹€ц兘鐩戞帶锛夈€傚湪閲嶆瀯闃舵浜屼腑锛屽宸ュ叿鍑芥暟杩涜浜嗗畬鏁寸殑妯″潡鍖栨敼閫狅紝灏哷config-loader.js`杩佺Щ鍒癭common/`鐩綍锛屽缓绔嬩簡缁熶竴鐨勫鍑轰綋绯伙紝姣忎釜瀛愮洰褰曢兘鏈夌嫭绔嬬殑`index.js`瀵煎嚭鏂囦欢銆傛彁楂樹簡缁勭粐缁撴瀯娓呮櫚搴﹀拰浠ｇ爜澶嶇敤鎬э紝鍚屾椂纭繚鍚戝悗鍏煎鎬э拷?|
| `services/` | 鍖呭惈API鏈嶅姟锛屽鐞嗕笌鍚庣鐨勪氦浜掞紝鎸変笟鍔℃ā鍧楃粍缁囥€傛瘡涓湇鍔″皝瑁呯壒瀹氶鍩熺殑API璋冪敤閫昏緫锟?|
| `store/` | 鍖呭惈鐘舵€佺鐞嗙浉鍏充唬鐮侊紝鎸夊姛鑳芥ā鍧楃粍缁囥€傝礋璐ｇ鐞嗗簲鐢ㄥ叏灞€鐘舵€侊紝鍝嶅簲鐢ㄦ埛鎿嶄綔骞舵洿鏂癠I锟?|
| `styles/` | 鍖呭惈鍏ㄥ眬鏍峰紡鍜屼富棰橈紝鍖呮嫭鍙橀噺銆侀噸缃€佹帓鐗堝拰鍝嶅簲寮忔牱寮忕瓑銆傚湪閲嶆瀯闃舵浜屼腑锛屾柊澧炰簡鍝嶅簲寮忔牱寮忔敮鎸侊紝纭繚搴旂敤瑙嗚椋庢牸鐨勪竴鑷存€у拰璺ㄨ澶囬€傞厤鑳藉姏锟?|
| `types/` | 鍖呭惈TypeScript绫诲瀷瀹氫箟锛屾寜涓氬姟棰嗗煙缁勭粐銆傛彁渚涚被鍨嬪畨鍏紝鎻愰珮浠ｇ爜鍙淮鎶ゆ€э拷?|

#### 3.2.2 鍏朵粬鐩綍

| 鐩綍 | 璇存槑 |
|------|------|
| `public/` | 鍖呭惈闈欐€佽祫婧愶紝濡傚浘鐗囥€佸浘鏍囥€佸瓧浣撶瓑銆傝繖浜涜祫婧愮洿鎺ヨ閮ㄧ讲鍒版湇鍔″櫒锛屼笉缁忚繃鎵撳寘澶勭悊锟?|
| `tests/` | 鍖呭惈娴嬭瘯鏂囦欢锛屽垎涓哄崟鍏冩祴璇曘€侀泦鎴愭祴璇曞拰绔埌绔祴璇曘€傚湪閲嶆瀯闃舵浜屼腑锛屾柊澧炰簡娴嬭瘯鐜妯℃嫙(test-environment-mocks.js)锛屼负鎬ц兘鐩戞帶鍜岀綉缁滄祴璇曟彁渚涙ā鎷熺幆澧冦€傜‘淇濅唬鐮佽川閲忓拰鍔熻兘姝ｇ‘鎬э拷?|
| `config/` | 鍖呭惈閰嶇疆鏂囦欢锛屾寜鐢ㄩ€斿垎绫伙紙榛樿閰嶇疆銆佺幆澧冮厤缃€佹湇鍔″櫒閰嶇疆銆佹瀯寤洪厤缃€佹祴璇曢厤缃級銆傞泦涓鐞嗗簲鐢ㄧ殑鍚勭閰嶇疆椤癸紝鎻愪緵鍗曚竴鐪熺浉鏉ユ簮銆傝繖涓€缁撴瀯鏄疶ASK-003閰嶇疆鏂囦欢鏁村悎鐨勬垚鏋滐紝灏嗗師鏈垎鏁ｇ殑閰嶇疆鏂囦欢闆嗕腑骞舵寜鑱岃矗缁勭粐锟?|

### 3.2.3 閰嶇疆鐩綍缁撴瀯

`config/` 鐩綍閲囩敤浜嗘ā鍧楀寲鍜岀幆澧冨垎绂荤殑鍘熷垯锛岀粍缁囧涓嬶細

| 鐩綍/鏂囦欢 | 璇存槑 |
|---------|------|
| `default/` | 鍖呭惈鍚勬ā鍧楃殑榛樿閰嶇疆锛岄€傜敤浜庢墍鏈夌幆锟?|
| `environments/` | 鍖呭惈閽堝鐗瑰畾鐜鐨勯厤缃鐩栵紝浠呭寘鍚笌榛樿閰嶇疆涓嶅悓鐨勫唴锟?|
| `server/` | 鏈嶅姟鍣ㄧ浉鍏抽厤缃紝鍖呮嫭API鏈嶅姟鍣ㄣ€佸紑鍙戞湇鍔″櫒绛夎锟?|
| `build/` | 鏋勫缓宸ュ叿閰嶇疆锛屽Babel銆丳ostCSS绛夛紝浠庨」鐩牴鐩綍杩佺Щ |
| `test/` | 娴嬭瘯妗嗘灦閰嶇疆锛屽寘鎷琂est绛夋祴璇曞伐鍏风殑璁剧疆 |
| `assets.js` | 璧勬簮绠＄悊鐩稿叧閰嶇疆 |

閰嶇疆绯荤粺閲囩敤鍒嗗眰鍔犺浇鏈哄埗锛岄€氳繃 `src/utils/common/config-loader.js` 缁熶竴璁块棶锛屽彲鑷姩璇嗗埆褰撳墠鐜骞跺悎骞剁浉搴旈厤缃拷?
鍦═ASK-003涓紝鍘熷厛浣嶄簬椤圭洰鏍圭洰褰曠殑閰嶇疆鏂囦欢锛堝babel.config.js銆乸ostcss.config.js銆乯est.config.js绛夛級宸插叏閮ㄨ縼绉诲埌瀵瑰簲鐨勫瓙鐩綍涓苟鍒犻櫎鍘熷鏂囦欢锛屼互瀹炵幇鏇村ソ鐨勭粍缁囧拰绠＄悊锟?
## 馃摎 鏂囨。鏇存柊璁板綍

### 2025-01-15 鏇存柊

#### Phase-3鏂囨。comprehensive鏇存柊 (鍩轰簬API Client鍥炲綊闂)
- **PHASE-3-MASTER-STATUS.md**: 馃攧 娣诲姞API Client鍥炲綊椋庨櫓璁板綍锛岃皟鏁村畬鎴愬害45-50%
- **PHASE-3-EMERGENCY-ASSESSMENT.md**: 馃毃 鏂板鍥炲綊闂鍒嗘瀽绔犺妭锛岃缁嗚锟?3涓祴璇曞け锟?- **PHASE-3-COMPREHENSIVE-PLAN.md**: 馃搵 鏇存柊浠诲姟鐘舵€侊紝鍙嶆槧API Client鍥炲綊淇闇€锟?- **PHASE-3-COMPREHENSIVE-PLAN.md**: 锟?娣诲姞API Client鍥炲綊淇闃舵锛岃皟鏁村伐浣滈噸锟?- **PHASE-3-COMPREHENSIVE-PLAN.md**: 馃攳 娣卞害鍒嗘瀽鍥炲綊鏍瑰洜锛屽埗瀹氫慨澶嶇瓥锟?- **REFACTOR-PHASE3-CHANGELOG.md**: 馃摑 璁板綍瀹屾暣鐨勫洖褰掑彂鐜板拰淇瑙勫垝杩囩▼
- **TASK-P3-016A-鏍囧噯鍖栧伐浣滄竻锟?md**: 馃搳 娣诲姞鍥炲綊闂淇璇存槑
- **PHASE-3-COMPREHENSIVE-PLAN.md**: 馃彈锟?鏇存柊鏈€鏂扮姸鎬佸拰淇閲嶇偣
- **PHASE-3-STATUS-UPDATE.md**: 馃搱 璋冩暣鐘舵€佹瑙堬紝鍙嶆槧鍥炲綊褰卞搷
- **TASK-P3-016A-鐪熷疄鐘舵€佽拷锟?md**: 馃搵 璁板綍鍥炲綊闂鍙戠幇鍜屼慨澶嶆柟锟?
**鏇存柊渚濇嵁**: 鎸夌収@development-management-unified.mdc瑙勫垯锛岀‘淇濋」鐩姸鎬佹枃妗ｄ笌鐪熷疄鎶€鏈姸鎬佸悓锟?**鏇存柊閲嶇偣**: 鍙嶆槧鐢ㄦ埛浠ｇ爜淇寮曞彂鐨凙PI Client鍥炲綊闂锛屼繚鎸佹枃妗ｉ€忔槑搴﹀拰鍑嗙‘锟?
---

**鏂囨。鎬ц川**: 褰撳墠鐩綍缁撴瀯璇存槑  
**鍙樻洿鍘嗗彶**: 璇锋煡锟?[docs/directory-structure-changelog.md](docs/directory-structure-changelog.md)  
**鏈€鍚庢洿锟?*: 2025-01-15 27:15 (宸叉洿鏂癙hase-3淇瀹屾垚鐘讹拷?  

