"""Section contract tests - every section handler must satisfy this interface."""
import pytest
from smartbi.services.restaurant.sections.base import (
    SectionRequest, SectionResponse, AbstractSectionHandler,
    SectionStatus,
)


def test_section_request_accepts_factory_and_upload():
    req = SectionRequest(
        factory_id="F001",
        upload_id="u-123",
        sub_sector="火锅",
        store_id=None,
        store_name=None,
        params={},
    )
    assert req.factory_id == "F001"
    assert req.upload_id == "u-123"
    assert req.sub_sector == "火锅"


def test_section_response_status_enum():
    resp = SectionResponse(
        section_name="cost_rigidity",
        status=SectionStatus.OK,
        data={"costRigidity": 0.561},
        warnings=[],
        cache_key="cost_rigidity:F001:u-123",
        computed_at_ms=42,
    )
    assert resp.status == SectionStatus.OK
    assert resp.data["costRigidity"] == 0.561


def test_abstract_handler_enforces_compute_method():
    class BrokenHandler(AbstractSectionHandler):
        section_name = "broken"
        # Missing compute() implementation
        pass

    with pytest.raises(TypeError):
        BrokenHandler()
