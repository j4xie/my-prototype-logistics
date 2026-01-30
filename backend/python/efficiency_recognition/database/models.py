"""
SQLAlchemy Models for Efficiency Recognition PostgreSQL Tables

Tables:
- worker_tracking_features: VL-extracted full-body features
- worker_trajectory: Worker movement history
- camera_topology: Camera spatial relationships
- camera_scene_understanding: LLM scene analysis
- scene_change_history: Detected scene changes
- efficiency_cost_records: API cost tracking
"""

from datetime import datetime
from typing import Dict, Any, Optional

from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Boolean, Float, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class WorkerTrackingFeature(Base):
    """
    Worker tracking features extracted by VL model.
    Stores full-body multi-dimensional features for cross-camera tracking.
    """
    __tablename__ = "worker_tracking_features"

    id = Column(String(36), primary_key=True)
    factory_id = Column(String(20), nullable=False, index=True)
    tracking_id = Column(String(36), nullable=False, unique=True, index=True)
    worker_id = Column(BigInteger, nullable=True, index=True)

    # VL-extracted features
    badge_number = Column(String(20), nullable=True, index=True)
    clothing_upper = Column(String(100), nullable=True)
    clothing_lower = Column(String(100), nullable=True)
    body_type = Column(String(20), nullable=True)  # THIN/MEDIUM/HEAVY
    height_estimate = Column(String(20), nullable=True)  # SHORT/MEDIUM/TALL
    safety_gear = Column(JSONB, nullable=True)

    # Location and time
    last_seen_camera = Column(String(36), nullable=True, index=True)
    last_seen_time = Column(DateTime, nullable=True, index=True)
    first_seen_time = Column(DateTime, nullable=True)
    total_sightings = Column(Integer, default=0)

    # Confidence
    feature_confidence = Column(Float, default=0.0)

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    trajectories = relationship("WorkerTrajectory", back_populates="tracking_feature", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "trackingId": self.tracking_id,
            "workerId": self.worker_id,
            "badgeNumber": self.badge_number,
            "clothingUpper": self.clothing_upper,
            "clothingLower": self.clothing_lower,
            "bodyType": self.body_type,
            "heightEstimate": self.height_estimate,
            "safetyGear": self.safety_gear,
            "lastSeenCamera": self.last_seen_camera,
            "lastSeenTime": self.last_seen_time.isoformat() if self.last_seen_time else None,
            "firstSeenTime": self.first_seen_time.isoformat() if self.first_seen_time else None,
            "totalSightings": self.total_sightings,
            "featureConfidence": self.feature_confidence,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class WorkerTrajectory(Base):
    """
    Worker movement history across cameras.
    Records each sighting with timestamp and location.
    """
    __tablename__ = "worker_trajectory"

    id = Column(String(36), primary_key=True)
    factory_id = Column(String(20), nullable=False, index=True)
    tracking_id = Column(String(36), ForeignKey("worker_tracking_features.tracking_id"), nullable=False, index=True)
    camera_id = Column(String(36), nullable=False, index=True)

    # Time
    enter_time = Column(DateTime, nullable=False, index=True)
    exit_time = Column(DateTime, nullable=True)

    # Position and action
    position_in_frame = Column(String(50), nullable=True)
    action_description = Column(String(200), nullable=True)

    # Confidence and snapshot
    confidence = Column(Float, default=0.0)
    snapshot_url = Column(String(500), nullable=True)

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    tracking_feature = relationship("WorkerTrackingFeature", back_populates="trajectories")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "trackingId": self.tracking_id,
            "cameraId": self.camera_id,
            "enterTime": self.enter_time.isoformat() if self.enter_time else None,
            "exitTime": self.exit_time.isoformat() if self.exit_time else None,
            "positionInFrame": self.position_in_frame,
            "actionDescription": self.action_description,
            "confidence": self.confidence,
        }


class CameraTopology(Base):
    """
    Camera spatial relationships.
    Defines typical transition times between cameras.
    """
    __tablename__ = "camera_topology"

    id = Column(String(36), primary_key=True)
    factory_id = Column(String(20), nullable=False, index=True)
    camera_a_id = Column(String(36), nullable=False, index=True)
    camera_b_id = Column(String(36), nullable=False, index=True)

    transition_time_seconds = Column(Integer, default=30)
    direction = Column(String(20), default="BIDIRECTIONAL")  # A_TO_B / B_TO_A / BIDIRECTIONAL
    distance_meters = Column(Float, nullable=True)
    path_description = Column(String(200), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "cameraAId": self.camera_a_id,
            "cameraBId": self.camera_b_id,
            "transitionTimeSeconds": self.transition_time_seconds,
            "direction": self.direction,
            "distanceMeters": self.distance_meters,
            "pathDescription": self.path_description,
        }


class CameraSceneUnderstanding(Base):
    """
    LLM-generated scene understanding.
    Stores equipment, workstations, zones, and workflow analysis.
    """
    __tablename__ = "camera_scene_understanding"

    id = Column(String(36), primary_key=True)
    factory_id = Column(String(20), nullable=False, index=True)
    camera_id = Column(String(36), nullable=False, index=True)

    # LLM analysis results
    scene_description = Column(Text, nullable=True)
    detected_equipment = Column(JSONB, nullable=True)
    detected_workstations = Column(JSONB, nullable=True)
    detected_zones = Column(JSONB, nullable=True)
    workflow_understanding = Column(Text, nullable=True)

    # Reference frame
    reference_frame_url = Column(String(500), nullable=True)

    # Status
    confidence = Column(Float, default=0.0)
    is_current = Column(Boolean, default=True, index=True)

    # Time
    captured_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "cameraId": self.camera_id,
            "sceneDescription": self.scene_description,
            "detectedEquipment": self.detected_equipment,
            "detectedWorkstations": self.detected_workstations,
            "detectedZones": self.detected_zones,
            "workflowUnderstanding": self.workflow_understanding,
            "confidence": self.confidence,
            "isCurrent": self.is_current,
            "capturedAt": self.captured_at.isoformat() if self.captured_at else None,
        }


class SceneChangeHistory(Base):
    """
    Scene change detection history.
    Records LLM-detected changes and suggested actions.
    """
    __tablename__ = "scene_change_history"

    id = Column(String(36), primary_key=True)
    factory_id = Column(String(20), nullable=False, index=True)
    camera_id = Column(String(36), nullable=False, index=True)

    # LLM analysis
    change_summary = Column(Text, nullable=True)
    change_details = Column(JSONB, nullable=True)
    impact_assessment = Column(Text, nullable=True)
    impact_level = Column(String(20), default="low", index=True)  # low/medium/high/critical
    suggested_actions = Column(JSONB, nullable=True)

    # Status
    change_confidence = Column(Float, default=0.0)
    applied = Column(Boolean, default=False, index=True)
    applied_at = Column(DateTime, nullable=True)
    reviewed_by = Column(BigInteger, nullable=True)

    # Time
    detected_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "cameraId": self.camera_id,
            "changeSummary": self.change_summary,
            "changeDetails": self.change_details,
            "impactAssessment": self.impact_assessment,
            "impactLevel": self.impact_level,
            "suggestedActions": self.suggested_actions,
            "changeConfidence": self.change_confidence,
            "applied": self.applied,
            "detectedAt": self.detected_at.isoformat() if self.detected_at else None,
        }


class EfficiencyCostRecord(Base):
    """
    API call cost tracking.
    Records token usage and costs for each VL API call.
    """
    __tablename__ = "efficiency_cost_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    factory_id = Column(String(20), nullable=True, index=True)

    # Call info
    model_name = Column(String(50), nullable=False, index=True)
    analysis_type = Column(String(30), nullable=True)
    camera_id = Column(String(36), nullable=True)

    # Tokens and cost
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_rmb = Column(Float, default=0.0)

    # Optimization info
    skipped_by_preprocess = Column(Boolean, default=False)
    optimization_mode = Column(String(20), nullable=True, index=True)

    # Time
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "factoryId": self.factory_id,
            "modelName": self.model_name,
            "analysisType": self.analysis_type,
            "cameraId": self.camera_id,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "totalTokens": self.total_tokens,
            "costRmb": self.cost_rmb,
            "skippedByPreprocess": self.skipped_by_preprocess,
            "optimizationMode": self.optimization_mode,
            "recordedAt": self.recorded_at.isoformat() if self.recorded_at else None,
        }
