#!/usr/bin/env python3
"""Generate IntentKnowledgeBase audit report."""
import re, json, collections, sys, os

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    kb_path = os.path.join(base_dir, 'backend-java', 'src', 'main', 'java', 'com', 'cretas', 'aims', 'config', 'IntentKnowledgeBase.java')

    with open(kb_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Extract all phraseToIntentMapping.put entries
    pattern = r'phraseToIntentMapping\.put\("([^"]+)",\s*"([^"]+)"\)'
    matches = re.findall(pattern, content)

    phrase_to_intent = {}
    all_entries = []
    phrase_occurrences = collections.defaultdict(list)

    for phrase, intent in matches:
        all_entries.append((phrase, intent))
        phrase_occurrences[phrase].append(intent)
        phrase_to_intent[phrase] = intent

    intent_phrase_counts = collections.Counter()
    for phrase, intent in phrase_to_intent.items():
        intent_phrase_counts[intent] += 1

    sorted_counts = dict(sorted(intent_phrase_counts.items(), key=lambda x: -x[1]))

    # 2. Duplicates (same phrase, different intents)
    duplicates = []
    for phrase, intents in phrase_occurrences.items():
        unique_intents = list(dict.fromkeys(intents))
        if len(unique_intents) > 1:
            duplicates.append({
                'phrase': phrase,
                'intents': unique_intents,
                'final_winner': phrase_to_intent[phrase],
                'count': len(intents)
            })

    # 3. Redundant entries
    redundant_entries = []
    for phrase, intents in phrase_occurrences.items():
        if len(intents) > 1 and len(set(intents)) == 1:
            redundant_entries.append({'phrase': phrase, 'intent': intents[0], 'count': len(intents)})
    redundant_entries.sort(key=lambda x: -x['count'])

    # 4. Classification
    undertrained = {k: v for k, v in sorted_counts.items() if v < 3}
    well_covered = {k: v for k, v in sorted_counts.items() if v > 10}
    medium = {k: v for k, v in sorted_counts.items() if 3 <= v <= 10}

    # 5. Domain gap analysis
    all_intents = set(sorted_counts.keys())
    domain_gaps = []

    # Check: Maintenance/TPM
    maintenance_intents = [i for i in all_intents if 'MAINTENANCE' in i or 'TPM' in i]
    domain_gaps.append({
        'domain': 'Preventive Maintenance / TPM',
        'description': 'Only EQUIPMENT_MAINTENANCE exists. Missing: preventive maintenance schedules, TPM metrics (MTBF/MTTR), spare parts inventory, maintenance work orders, calibration tracking',
        'existing_intents': maintenance_intents,
        'severity': 'HIGH'
    })

    # Check: Cold chain compliance
    cold_chain_intents = [i for i in all_intents if 'COLD_CHAIN' in i or 'TEMPERATURE' in i]
    domain_gaps.append({
        'domain': 'Cold Chain Compliance',
        'description': 'Only COLD_CHAIN_TEMPERATURE exists (20 phrases). Missing: cold chain breach alerts, compliance reports, temperature log export, humidity monitoring, cold chain certification status',
        'existing_intents': cold_chain_intents,
        'severity': 'HIGH'
    })

    # Check: Lab testing / food safety testing
    lab_intents = [i for i in all_intents if 'LAB' in i or 'TEST' in i or 'FOOD_SAFETY' in i]
    domain_gaps.append({
        'domain': 'Lab Testing / Food Safety Testing',
        'description': 'No dedicated lab testing intents. Missing: microbiological test results, chemical analysis (heavy metals, pesticide residue), shelf life testing, lab sample tracking, third-party test certificates',
        'existing_intents': lab_intents,
        'severity': 'HIGH'
    })

    # Check: Financial ratios / P&L
    finance_intents = [i for i in all_intents if 'FINANCE' in i or 'COST' in i or 'PROFIT' in i or 'BUDGET' in i]
    domain_gaps.append({
        'domain': 'Financial Ratios / P&L / Budgeting',
        'description': 'Only REPORT_FINANCE and COST_QUERY exist. Missing: gross margin analysis, budget vs actual, cash flow, accounts receivable/payable aging, break-even analysis, financial forecasting',
        'existing_intents': list(finance_intents),
        'severity': 'MEDIUM'
    })

    # Check: Recall management
    recall_intents = [i for i in all_intents if 'RECALL' in i]
    domain_gaps.append({
        'domain': 'Product Recall Management',
        'description': 'No recall management intents. Missing: recall initiation, affected batch identification, recall status tracking, recall notification, recall completion report. Critical for food safety.',
        'existing_intents': recall_intents,
        'severity': 'CRITICAL'
    })

    # Check: Regulatory compliance
    compliance_intents = [i for i in all_intents if 'COMPLIANCE' in i or 'REGULATION' in i or 'AUDIT' in i or 'CERTIFICATION' in i]
    domain_gaps.append({
        'domain': 'Regulatory Compliance / Certifications',
        'description': 'No regulatory compliance intents. Missing: FDA/CFDA compliance status, ISO22000 audit tracking, organic/halal/kosher certification, regulatory document management, compliance gap analysis',
        'existing_intents': list(compliance_intents),
        'severity': 'HIGH'
    })

    # Check: Waste management / yield
    waste_intents = [i for i in all_intents if 'WASTE' in i or 'YIELD' in i or 'SCRAP' in i]
    domain_gaps.append({
        'domain': 'Waste Management / Yield Optimization',
        'description': 'No waste/yield intents. Missing: waste tracking by category, yield rate analysis, scrap reasons analysis, waste reduction trends, by-product utilization',
        'existing_intents': list(waste_intents),
        'severity': 'MEDIUM'
    })

    # Check: Energy / utilities
    energy_intents = [i for i in all_intents if 'ENERGY' in i or 'UTILITY' in i or 'WATER' in i or 'POWER' in i]
    domain_gaps.append({
        'domain': 'Energy / Utilities Management',
        'description': 'No energy/utilities intents. Missing: electricity consumption tracking, water usage, gas consumption, utility cost analysis, energy efficiency metrics, carbon footprint',
        'existing_intents': list(energy_intents),
        'severity': 'MEDIUM'
    })

    # Check: Cleaning / sanitation (CIP)
    cleaning_intents = [i for i in all_intents if 'CLEAN' in i or 'SANIT' in i or 'CIP' in i]
    domain_gaps.append({
        'domain': 'Cleaning / Sanitation (CIP)',
        'description': 'No cleaning/sanitation intents. Missing: CIP (Clean-in-Place) scheduling, sanitation verification, cleaning chemical tracking, hygiene audit results, allergen control',
        'existing_intents': list(cleaning_intents),
        'severity': 'HIGH'
    })

    # Check: Packaging
    packaging_intents = [i for i in all_intents if 'PACKAG' in i or 'LABEL' in i]
    domain_gaps.append({
        'domain': 'Packaging / Labeling',
        'description': 'No packaging/labeling intents. Missing: packaging material inventory, label verification, packaging line status, packaging defect tracking, label compliance check',
        'existing_intents': list(packaging_intents),
        'severity': 'LOW'
    })

    # Check: Recipe / formulation management
    recipe_intents = [i for i in all_intents if 'RECIPE' in i or 'FORMULA' in i]
    domain_gaps.append({
        'domain': 'Recipe / Formulation Management',
        'description': 'No recipe management intents. Missing: recipe lookup, ingredient substitution, batch scaling calculations, recipe version control, allergen declaration per recipe',
        'existing_intents': list(recipe_intents),
        'severity': 'MEDIUM'
    })

    # Check: Pest control
    pest_intents = [i for i in all_intents if 'PEST' in i]
    domain_gaps.append({
        'domain': 'Pest Control',
        'description': 'No pest control intents. Missing: pest inspection records, bait station monitoring, pest trend analysis, corrective action tracking',
        'existing_intents': list(pest_intents),
        'severity': 'LOW'
    })

    # 6. Extract other maps from the file
    map_pattern = r'private\s+(?:final\s+)?(?:Map|HashMap|Set|HashSet|List|ArrayList)<[^>]+>\s+(\w+)'
    map_matches = re.findall(map_pattern, content)
    other_maps = sorted(set(map_matches))

    # 7. Extract enums
    enum_pattern = r'public enum (\w+)\s*\{'
    enum_matches = re.findall(enum_pattern, content)

    # 8. Check for synonymMap
    synonym_pattern = r'synonymMap\.put\("([^"]+)",\s*"([^"]+)"\)'
    synonym_matches = re.findall(synonym_pattern, content)

    # 9. Check matching method features
    match_method_lines = [
        'matchPhrase: contains-based matching with coverage ratio threshold (40%)',
        'Exact match always passes, long phrases (>=4 chars) always pass',
        'STRONG_SHORT_PHRASES bypass coverage check',
        'Sorted by phrase length DESC (longest match first = most specific wins)',
        'Gap-tolerant matching allows particles between key terms (e.g. "cold storage" + "de" + "temperature")',
        'Pipeline: phraseMatch (0.98 conf) -> BERT classifier -> semantic router -> keyword match -> LLM fallback',
        'Preprocessing: tone word removal, oral->standard Chinese, coreference resolution',
        'VerbNoun disambiguation for create vs query confusion'
    ]

    # 10. Phrases per intent - also list the actual phrases for undertrained intents
    undertrained_details = {}
    for intent_code in undertrained:
        phrases_for_intent = [p for p, i in phrase_to_intent.items() if i == intent_code]
        undertrained_details[intent_code] = {
            'count': undertrained[intent_code],
            'phrases': phrases_for_intent
        }

    # Build final audit report
    audit_report = {
        'audit_metadata': {
            'file': 'backend-java/src/main/java/com/cretas/aims/config/IntentKnowledgeBase.java',
            'audit_date': '2026-02-10',
            'total_put_calls': len(all_entries),
            'total_unique_phrases': len(phrase_to_intent),
            'total_unique_intents': len(intent_phrase_counts),
            'total_duplicate_phrase_mappings': len(duplicates),
            'total_redundant_entries': len(redundant_entries),
            'wasted_entries': len(all_entries) - len(phrase_to_intent),
        },
        'matching_method': match_method_lines,
        'intent_phrase_counts': sorted_counts,
        'intent_classification': {
            'well_covered_count': len(well_covered),
            'well_covered': dict(sorted(well_covered.items(), key=lambda x: -x[1])),
            'medium_count': len(medium),
            'medium': dict(sorted(medium.items(), key=lambda x: -x[1])),
            'undertrained_count': len(undertrained),
            'undertrained': dict(sorted(undertrained.items(), key=lambda x: -x[1]))
        },
        'undertrained_details': undertrained_details,
        'duplicate_phrase_mappings': sorted(duplicates, key=lambda x: x['phrase']),
        'redundant_entries_top20': redundant_entries[:20],
        'domain_gaps': domain_gaps,
        'other_knowledge_structures': {
            'map_and_set_fields': other_maps,
            'enums': sorted(enum_matches),
            'synonym_mappings_count': len(synonym_matches),
            'has_conversational_indicators': 'conversationalIndicators' in content,
            'has_strong_short_phrases': 'STRONG_SHORT_PHRASES' in content,
            'has_domain_keywords': 'domainKeywords' in content,
            'has_stop_words': 'stopWords' in content,
            'has_action_indicators': 'operationalIndicators' in content or 'actionIndicators' in content,
            'has_general_question_indicators': 'generalQuestionIndicators' in content,
            'has_verb_noun_disambiguation': 'disambiguateByVerbNoun' in content,
            'has_granularity_detection': 'detectGranularity' in content,
            'has_gap_tolerant_matching': 'gapMatchIntent' in content
        },
        'summary': {
            'strengths': [
                f'{len(well_covered)} intents with >10 phrases each (well-covered)',
                f'{len(phrase_to_intent)} unique phrase mappings total',
                'Comprehensive coverage of core domains: production, equipment, quality, shipment, materials, alerts',
                'Good colloquial/dialect Chinese coverage (oral expressions, factory slang)',
                'Industry jargon mapped: HACCP, CCP, GMP, OEE, SPC, BOM, FIFO, WMS, TMS, ERP, SCADA',
                'Multi-layer matching pipeline: phrase match -> BERT classifier -> semantic router -> LLM fallback',
                'Typo tolerance (e.g., 考琴记录 -> ATTENDANCE_HISTORY)',
                'Gap-tolerant matching allows particles between key terms',
                'Strong short phrases bypass coverage ratio check for unambiguous 2-char verbs'
            ],
            'weaknesses': [
                f'{len(undertrained)} intents have < 3 phrases (undertrained, unreliable matching)',
                f'{len(duplicates)} phrases map to different intents (HashMap last-write-wins creates silent bugs)',
                f'{len(redundant_entries)} redundant .put() calls (same phrase, same intent, wasted)',
                f'{len(all_entries) - len(phrase_to_intent)} total wasted .put() calls (overwritten or duplicate)',
                'No recall management intents (critical for food safety)',
                'No lab testing / food safety testing intents',
                'No regulatory compliance intents (FDA, CFDA, ISO22000)',
                'No CIP/sanitation intents',
                'No recipe/formulation management intents',
                'No waste/yield tracking intents',
                'No energy/utilities management intents',
                'Comparison/MoM/YoY intents have only 1-2 phrases each (undertrained)',
                'Some duplicate phrases silently lose intended mapping (e.g., "出库单" overwrites SHIPMENT_QUERY with SHIPMENT_CREATE)',
                'File is 5000+ lines of hardcoded .put() calls - difficult to maintain and review'
            ],
            'recommendations': [
                'PRIORITY 1: Add recall management intents (regulatory requirement for food manufacturing)',
                'PRIORITY 2: Expand all 38 undertrained intents to at least 5 phrases each',
                'PRIORITY 3: Resolve 50 duplicate phrase conflicts (audit each, choose correct intent, remove duplicate)',
                'PRIORITY 4: Remove 165+ redundant .put() calls to reduce file size and confusion',
                'PRIORITY 5: Add food safety testing / lab result intents',
                'PRIORITY 6: Add regulatory compliance / certification tracking intents',
                'PRIORITY 7: Add CIP/sanitation, waste management, recipe management intents',
                'CONSIDER: Refactor phrase mappings to a structured data file (JSON/YAML) loaded at startup instead of hardcoded .put() calls'
            ]
        }
    }

    # Write JSON
    output_path = os.path.join(base_dir, 'tests', 'ai-intent', 'analysis', 'knowledgebase_audit.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(audit_report, f, ensure_ascii=False, indent=2)

    print(f'Audit report saved to: {output_path}')
    print(f'Total .put() calls: {len(all_entries)}')
    print(f'Unique phrases: {len(phrase_to_intent)}')
    print(f'Unique intents: {len(intent_phrase_counts)}')
    print(f'Undertrained (<3 phrases): {len(undertrained)}')
    print(f'Well-covered (>10 phrases): {len(well_covered)}')
    print(f'Duplicates (different intents): {len(duplicates)}')
    print(f'Redundant (same intent): {len(redundant_entries)}')
    print(f'Domain gaps: {len(domain_gaps)}')

if __name__ == '__main__':
    main()
