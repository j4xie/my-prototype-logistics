"""ai/matcher/fusion.py — weighted fusion of stage 5 + 6."""
from __future__ import annotations


def test_fusion_combines_overlapping_candidates():
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.matcher.fusion import fuse
    sem = [
        CandidateIntentDto(intentCode="A", intentName="A", confidence=0.9,
                            matchMethod=MatchMethod.SEMANTIC),
        CandidateIntentDto(intentCode="B", intentName="B", confidence=0.5,
                            matchMethod=MatchMethod.SEMANTIC),
    ]
    cls = [
        CandidateIntentDto(intentCode="A", intentName="A", confidence=0.7,
                            matchMethod=MatchMethod.CLASSIFIER),
        CandidateIntentDto(intentCode="C", intentName="C", confidence=0.6,
                            matchMethod=MatchMethod.CLASSIFIER),
    ]
    fused = fuse(sem, cls, w_sem=0.6, w_cls=0.4)
    by_code = {c.intentCode: c for c in fused}
    assert abs(by_code["A"].confidence - 0.82) < 0.001
    assert abs(by_code["B"].confidence - 0.30) < 0.001
    assert abs(by_code["C"].confidence - 0.24) < 0.001
    assert all(c.matchMethod == MatchMethod.FUSION for c in fused)
    assert fused[0].intentCode == "A"


def test_fusion_handles_empty_inputs():
    from ai.matcher.fusion import fuse
    assert fuse([], []) == []


def test_fusion_handles_one_side_empty():
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.matcher.fusion import fuse
    sem = [CandidateIntentDto(intentCode="A", intentName="A", confidence=0.8,
                                matchMethod=MatchMethod.SEMANTIC)]
    fused = fuse(sem, [], w_sem=0.6, w_cls=0.4)
    assert len(fused) == 1
    assert abs(fused[0].confidence - 0.48) < 0.001


def test_is_strong_signal_threshold():
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.matcher.fusion import is_strong_signal
    high = [CandidateIntentDto(intentCode="X", intentName="X", confidence=0.85,
                                matchMethod=MatchMethod.FUSION)]
    low = [CandidateIntentDto(intentCode="X", intentName="X", confidence=0.50,
                               matchMethod=MatchMethod.FUSION)]
    assert is_strong_signal(high) is True
    assert is_strong_signal(low) is False
