"""
Efficiency Recognition Database Repository

Provides database operations for tracking and scene understanding data.
Falls back to in-memory storage if PostgreSQL is not available.
"""

import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Try to import database dependencies
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker, Session
    from sqlalchemy.pool import QueuePool
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    logger.warning("SQLAlchemy not available, using in-memory storage")

from .models import (
    Base,
    WorkerTrackingFeature,
    WorkerTrajectory,
    CameraTopology,
    CameraSceneUnderstanding,
    SceneChangeHistory,
    EfficiencyCostRecord
)


class EfficiencyRepository:
    """
    Repository for efficiency recognition data.
    Supports both PostgreSQL and in-memory storage.
    """

    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize repository.

        Args:
            database_url: PostgreSQL connection URL. If None, uses env vars or in-memory.
        """
        self.engine = None
        self.SessionLocal = None
        self._use_database = False

        # Try to connect to database
        if SQLALCHEMY_AVAILABLE:
            db_url = database_url or self._get_database_url()
            if db_url:
                try:
                    self.engine = create_engine(
                        db_url,
                        poolclass=QueuePool,
                        pool_size=5,
                        max_overflow=10,
                        pool_pre_ping=True,
                        echo=os.getenv("DEBUG", "false").lower() == "true"
                    )
                    self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

                    # Test connection and create tables
                    self._init_tables()
                    self._use_database = True
                    logger.info(f"PostgreSQL connected for efficiency recognition")
                except Exception as e:
                    logger.error(f"Failed to connect to PostgreSQL: {e}")
                    self._use_database = False

        if not self._use_database:
            logger.warning("Using in-memory storage for efficiency recognition data")
            # In-memory fallback
            self._tracking_records: Dict[str, Dict] = {}
            self._trajectories: Dict[str, List[Dict]] = {}
            self._camera_topology: Dict[str, Dict] = {}
            self._scene_understandings: Dict[str, Dict] = {}
            self._change_history: Dict[str, List[Dict]] = {}
            self._cost_records: List[Dict] = []

    def _get_database_url(self) -> Optional[str]:
        """Get database URL from environment variables."""
        enabled = os.getenv("POSTGRES_ENABLED", "false").lower() == "true"
        if not enabled:
            return None

        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        db = os.getenv("POSTGRES_DB", "smartbi_db")
        user = os.getenv("POSTGRES_USER", "smartbi_user")
        password = os.getenv("POSTGRES_PASSWORD", "")

        if not password:
            # Try alternative env var
            password = os.getenv("POSTGRES_SMARTBI_PASSWORD", "")

        if not password:
            logger.warning("PostgreSQL password not set, skipping database connection")
            return None

        return f"postgresql://{user}:{password}@{host}:{port}/{db}"

    def _init_tables(self):
        """Create tables if they don't exist."""
        if self.engine:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Efficiency recognition tables initialized")

    @contextmanager
    def get_session(self):
        """Get database session context manager."""
        if not self._use_database or not self.SessionLocal:
            raise RuntimeError("Database not available")

        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise
        finally:
            session.close()

    @property
    def is_database_enabled(self) -> bool:
        """Check if database is enabled."""
        return self._use_database

    # ==================== Tracking Features ====================

    def save_tracking_feature(
        self,
        tracking_id: str,
        factory_id: str,
        features: Dict[str, Any],
        camera_id: str,
        timestamp: datetime,
        confidence: float = 0.0
    ) -> str:
        """Save or update tracking feature."""
        if self._use_database:
            with self.get_session() as session:
                existing = session.query(WorkerTrackingFeature).filter_by(tracking_id=tracking_id).first()

                if existing:
                    # Update existing
                    existing.badge_number = features.get("badge_number")
                    existing.clothing_upper = features.get("clothing_upper", "")
                    existing.clothing_lower = features.get("clothing_lower", "")
                    existing.body_type = features.get("body_type", "")
                    existing.height_estimate = features.get("height_estimate", "")
                    existing.safety_gear = features.get("safety_gear", {})
                    existing.last_seen_camera = camera_id
                    existing.last_seen_time = timestamp
                    existing.total_sightings = (existing.total_sightings or 0) + 1
                    existing.feature_confidence = confidence
                    existing.updated_at = datetime.utcnow()
                else:
                    # Create new
                    record = WorkerTrackingFeature(
                        id=str(uuid.uuid4()),
                        factory_id=factory_id,
                        tracking_id=tracking_id,
                        badge_number=features.get("badge_number"),
                        clothing_upper=features.get("clothing_upper", ""),
                        clothing_lower=features.get("clothing_lower", ""),
                        body_type=features.get("body_type", ""),
                        height_estimate=features.get("height_estimate", ""),
                        safety_gear=features.get("safety_gear", {}),
                        last_seen_camera=camera_id,
                        last_seen_time=timestamp,
                        first_seen_time=timestamp,
                        total_sightings=1,
                        feature_confidence=confidence
                    )
                    session.add(record)

                return tracking_id
        else:
            # In-memory
            if tracking_id in self._tracking_records:
                record = self._tracking_records[tracking_id]
                record.update({
                    "features": features,
                    "last_camera_id": camera_id,
                    "last_seen_time": timestamp,
                    "total_sightings": record.get("total_sightings", 0) + 1,
                    "confidence": confidence
                })
            else:
                self._tracking_records[tracking_id] = {
                    "tracking_id": tracking_id,
                    "factory_id": factory_id,
                    "features": features,
                    "last_camera_id": camera_id,
                    "last_seen_time": timestamp,
                    "first_seen_time": timestamp,
                    "total_sightings": 1,
                    "confidence": confidence,
                    "worker_id": None
                }
            return tracking_id

    def save_trajectory_point(
        self,
        tracking_id: str,
        factory_id: str,
        camera_id: str,
        timestamp: datetime,
        position: str = "",
        action: str = "",
        confidence: float = 0.0
    ):
        """Save trajectory point."""
        if self._use_database:
            with self.get_session() as session:
                point = WorkerTrajectory(
                    id=str(uuid.uuid4()),
                    factory_id=factory_id,
                    tracking_id=tracking_id,
                    camera_id=camera_id,
                    enter_time=timestamp,
                    position_in_frame=position,
                    action_description=action,
                    confidence=confidence
                )
                session.add(point)
        else:
            if tracking_id not in self._trajectories:
                self._trajectories[tracking_id] = []
            self._trajectories[tracking_id].append({
                "camera_id": camera_id,
                "timestamp": timestamp,
                "position": position,
                "action": action,
                "confidence": confidence
            })

    def get_tracking_record(self, tracking_id: str) -> Optional[Dict]:
        """Get tracking record by ID."""
        if self._use_database:
            with self.get_session() as session:
                record = session.query(WorkerTrackingFeature).filter_by(tracking_id=tracking_id).first()
                return record.to_dict() if record else None
        else:
            return self._tracking_records.get(tracking_id)

    def get_recent_tracking_candidates(
        self,
        camera_id: str,
        time_window_seconds: int = 300,
        factory_id: Optional[str] = None
    ) -> List[Dict]:
        """Get recent tracking records for matching."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=time_window_seconds)

        if self._use_database:
            with self.get_session() as session:
                query = session.query(WorkerTrackingFeature).filter(
                    WorkerTrackingFeature.last_seen_time >= cutoff_time,
                    WorkerTrackingFeature.deleted_at.is_(None)
                )
                if factory_id:
                    query = query.filter(WorkerTrackingFeature.factory_id == factory_id)

                return [r.to_dict() for r in query.all()]
        else:
            results = []
            for record in self._tracking_records.values():
                if record.get("last_seen_time", datetime.min) >= cutoff_time:
                    results.append(record)
            return results

    def get_all_tracking_records(self, factory_id: Optional[str] = None) -> List[Dict]:
        """Get all tracking records."""
        if self._use_database:
            with self.get_session() as session:
                query = session.query(WorkerTrackingFeature).filter(
                    WorkerTrackingFeature.deleted_at.is_(None)
                )
                if factory_id:
                    query = query.filter(WorkerTrackingFeature.factory_id == factory_id)
                return [r.to_dict() for r in query.all()]
        else:
            return list(self._tracking_records.values())

    def link_tracking_to_worker(self, tracking_id: str, worker_id: int) -> bool:
        """Link tracking record to system worker."""
        if self._use_database:
            with self.get_session() as session:
                record = session.query(WorkerTrackingFeature).filter_by(tracking_id=tracking_id).first()
                if record:
                    record.worker_id = worker_id
                    return True
                return False
        else:
            if tracking_id in self._tracking_records:
                self._tracking_records[tracking_id]["worker_id"] = worker_id
                return True
            return False

    def get_trajectory(self, tracking_id: str) -> List[Dict]:
        """Get trajectory for tracking ID."""
        if self._use_database:
            with self.get_session() as session:
                points = session.query(WorkerTrajectory).filter_by(
                    tracking_id=tracking_id
                ).order_by(WorkerTrajectory.enter_time).all()
                return [p.to_dict() for p in points]
        else:
            return self._trajectories.get(tracking_id, [])

    def get_tracking_statistics(self, factory_id: Optional[str] = None) -> Dict[str, Any]:
        """Get tracking statistics."""
        now = datetime.utcnow()
        active_threshold = now - timedelta(minutes=30)

        if self._use_database:
            with self.get_session() as session:
                query = session.query(WorkerTrackingFeature).filter(
                    WorkerTrackingFeature.deleted_at.is_(None)
                )
                if factory_id:
                    query = query.filter(WorkerTrackingFeature.factory_id == factory_id)

                records = query.all()
                total = len(records)
                active = sum(1 for r in records if r.last_seen_time and r.last_seen_time >= active_threshold)
                linked = sum(1 for r in records if r.worker_id is not None)
                badge_identified = sum(1 for r in records if r.badge_number)

                # Trajectory count
                traj_count = session.query(WorkerTrajectory).count()

                return {
                    "total_tracks": total,
                    "active_tracks": active,
                    "linked_to_workers": linked,
                    "unlinked_tracks": total - linked,
                    "badge_identified": badge_identified,
                    "total_trajectory_points": traj_count,
                    "database_enabled": True
                }
        else:
            records = list(self._tracking_records.values())
            total = len(records)
            active = sum(1 for r in records if r.get("last_seen_time", datetime.min) >= active_threshold)
            linked = sum(1 for r in records if r.get("worker_id") is not None)

            return {
                "total_tracks": total,
                "active_tracks": active,
                "linked_to_workers": linked,
                "unlinked_tracks": total - linked,
                "total_trajectory_points": sum(len(t) for t in self._trajectories.values()),
                "database_enabled": False
            }

    # ==================== Camera Topology ====================

    def save_camera_topology(
        self,
        factory_id: str,
        camera_a_id: str,
        camera_b_id: str,
        transition_time_seconds: int = 30,
        direction: str = "BIDIRECTIONAL"
    ):
        """Save camera topology relationship."""
        key = f"{camera_a_id}_{camera_b_id}"

        if self._use_database:
            with self.get_session() as session:
                existing = session.query(CameraTopology).filter_by(
                    factory_id=factory_id,
                    camera_a_id=camera_a_id,
                    camera_b_id=camera_b_id
                ).first()

                if existing:
                    existing.transition_time_seconds = transition_time_seconds
                    existing.direction = direction
                    existing.updated_at = datetime.utcnow()
                else:
                    topology = CameraTopology(
                        id=str(uuid.uuid4()),
                        factory_id=factory_id,
                        camera_a_id=camera_a_id,
                        camera_b_id=camera_b_id,
                        transition_time_seconds=transition_time_seconds,
                        direction=direction
                    )
                    session.add(topology)
        else:
            self._camera_topology[key] = {
                "camera_a_id": camera_a_id,
                "camera_b_id": camera_b_id,
                "transition_time_seconds": transition_time_seconds,
                "direction": direction
            }

    def get_camera_topology(self, factory_id: Optional[str] = None) -> List[Dict]:
        """Get all camera topology relationships."""
        if self._use_database:
            with self.get_session() as session:
                query = session.query(CameraTopology).filter(
                    CameraTopology.deleted_at.is_(None)
                )
                if factory_id:
                    query = query.filter(CameraTopology.factory_id == factory_id)
                return [t.to_dict() for t in query.all()]
        else:
            return list(self._camera_topology.values())

    # ==================== Scene Understanding ====================

    def save_scene_understanding(
        self,
        camera_id: str,
        factory_id: str,
        scene_description: str,
        equipment: List[Dict],
        workstations: List[Dict],
        zones: List[Dict],
        workflow: str,
        confidence: float,
        captured_at: datetime
    ) -> str:
        """Save scene understanding."""
        scene_id = str(uuid.uuid4())

        if self._use_database:
            with self.get_session() as session:
                # Mark previous as not current
                session.query(CameraSceneUnderstanding).filter_by(
                    camera_id=camera_id,
                    is_current=True
                ).update({"is_current": False})

                # Save new
                understanding = CameraSceneUnderstanding(
                    id=scene_id,
                    factory_id=factory_id,
                    camera_id=camera_id,
                    scene_description=scene_description,
                    detected_equipment=equipment,
                    detected_workstations=workstations,
                    detected_zones=zones,
                    workflow_understanding=workflow,
                    confidence=confidence,
                    is_current=True,
                    captured_at=captured_at
                )
                session.add(understanding)
        else:
            self._scene_understandings[camera_id] = {
                "scene_id": scene_id,
                "camera_id": camera_id,
                "factory_id": factory_id,
                "scene_description": scene_description,
                "equipment": equipment,
                "workstations": workstations,
                "zones": zones,
                "workflow_understanding": workflow,
                "confidence": confidence,
                "captured_at": captured_at
            }

        return scene_id

    def get_current_scene_understanding(self, camera_id: str) -> Optional[Dict]:
        """Get current scene understanding for camera."""
        if self._use_database:
            with self.get_session() as session:
                record = session.query(CameraSceneUnderstanding).filter_by(
                    camera_id=camera_id,
                    is_current=True
                ).first()
                return record.to_dict() if record else None
        else:
            return self._scene_understandings.get(camera_id)

    def save_scene_change(
        self,
        camera_id: str,
        factory_id: str,
        change_summary: str,
        change_details: Dict,
        impact_assessment: str,
        impact_level: str,
        suggested_actions: List[Dict],
        confidence: float,
        detected_at: datetime
    ) -> str:
        """Save scene change detection result."""
        change_id = str(uuid.uuid4())

        if self._use_database:
            with self.get_session() as session:
                change = SceneChangeHistory(
                    id=change_id,
                    factory_id=factory_id,
                    camera_id=camera_id,
                    change_summary=change_summary,
                    change_details=change_details,
                    impact_assessment=impact_assessment,
                    impact_level=impact_level,
                    suggested_actions=suggested_actions,
                    change_confidence=confidence,
                    detected_at=detected_at
                )
                session.add(change)
        else:
            if camera_id not in self._change_history:
                self._change_history[camera_id] = []
            self._change_history[camera_id].append({
                "change_id": change_id,
                "camera_id": camera_id,
                "factory_id": factory_id,
                "change_summary": change_summary,
                "change_details": change_details,
                "impact_assessment": impact_assessment,
                "impact_level": impact_level,
                "suggested_actions": suggested_actions,
                "confidence": confidence,
                "detected_at": detected_at,
                "applied": False
            })

        return change_id

    def get_scene_change_history(
        self,
        camera_id: str,
        limit: int = 50,
        only_applied: Optional[bool] = None
    ) -> List[Dict]:
        """Get scene change history for camera."""
        if self._use_database:
            with self.get_session() as session:
                query = session.query(SceneChangeHistory).filter_by(camera_id=camera_id)
                if only_applied is not None:
                    query = query.filter_by(applied=only_applied)
                query = query.order_by(SceneChangeHistory.detected_at.desc()).limit(limit)
                return [c.to_dict() for c in query.all()]
        else:
            changes = self._change_history.get(camera_id, [])
            if only_applied is not None:
                changes = [c for c in changes if c.get("applied") == only_applied]
            return sorted(changes, key=lambda c: c.get("detected_at", datetime.min), reverse=True)[:limit]

    # ==================== Cost Records ====================

    def save_cost_record(
        self,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        cost_rmb: float,
        factory_id: Optional[str] = None,
        analysis_type: Optional[str] = None,
        camera_id: Optional[str] = None,
        optimization_mode: Optional[str] = None,
        skipped: bool = False
    ):
        """Save API cost record."""
        if self._use_database:
            with self.get_session() as session:
                record = EfficiencyCostRecord(
                    factory_id=factory_id,
                    model_name=model_name,
                    analysis_type=analysis_type,
                    camera_id=camera_id,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    cost_rmb=cost_rmb,
                    skipped_by_preprocess=skipped,
                    optimization_mode=optimization_mode
                )
                session.add(record)
        else:
            self._cost_records.append({
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "cost_rmb": cost_rmb,
                "factory_id": factory_id,
                "analysis_type": analysis_type,
                "camera_id": camera_id,
                "optimization_mode": optimization_mode,
                "skipped": skipped,
                "recorded_at": datetime.utcnow()
            })

    def get_cost_summary(self, days: int = 1, factory_id: Optional[str] = None) -> Dict[str, Any]:
        """Get cost summary for recent days."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        if self._use_database:
            with self.get_session() as session:
                query = session.query(EfficiencyCostRecord).filter(
                    EfficiencyCostRecord.recorded_at >= cutoff
                )
                if factory_id:
                    query = query.filter(EfficiencyCostRecord.factory_id == factory_id)

                records = query.all()
                total_calls = len(records)
                total_tokens = sum(r.total_tokens for r in records)
                total_cost = sum(r.cost_rmb for r in records)
                skipped = sum(1 for r in records if r.skipped_by_preprocess)

                return {
                    "total_calls": total_calls,
                    "total_tokens": total_tokens,
                    "total_cost_rmb": round(total_cost, 4),
                    "skipped_calls": skipped,
                    "database_enabled": True
                }
        else:
            records = [r for r in self._cost_records if r.get("recorded_at", datetime.min) >= cutoff]
            return {
                "total_calls": len(records),
                "total_tokens": sum(r.get("total_tokens", 0) for r in records),
                "total_cost_rmb": round(sum(r.get("cost_rmb", 0) for r in records), 4),
                "skipped_calls": sum(1 for r in records if r.get("skipped")),
                "database_enabled": False
            }


# Global repository instance
_repository: Optional[EfficiencyRepository] = None


def get_repository() -> EfficiencyRepository:
    """Get global repository instance."""
    global _repository
    if _repository is None:
        _repository = EfficiencyRepository()
    return _repository
