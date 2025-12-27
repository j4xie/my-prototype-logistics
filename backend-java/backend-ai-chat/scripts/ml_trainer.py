"""
ML模型训练器
用于训练 LightGBM 效率预测模型

训练触发条件：
- 训练数据量 >= 50条
- 数据量增长超过20%

模型类型：
- efficiency: 效率预测 (件/人/小时)
- duration: 时长预测 (小时)
- quality: 质量预测 (合格率)
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np
import joblib

# ML库 (需要安装: pip install lightgbm scikit-learn)
try:
    import lightgbm as lgb
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    logging.warning("LightGBM 未安装，ML训练功能不可用")

# MySQL连接 (需要安装: pip install pymysql)
try:
    import pymysql
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False
    logging.warning("PyMySQL 未安装，无法连接数据库")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== 配置 ====================

MODEL_DIR = os.environ.get('ML_MODEL_DIR', './models')
os.makedirs(MODEL_DIR, exist_ok=True)

# 数据库配置
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'cretas_db'),
    'charset': 'utf8mb4'
}

# LightGBM 默认参数
LGBM_PARAMS = {
    'objective': 'regression',
    'metric': 'rmse',
    'boosting_type': 'gbdt',
    'num_leaves': 31,
    'learning_rate': 0.05,
    'feature_fraction': 0.9,
    'bagging_fraction': 0.8,
    'bagging_freq': 5,
    'verbose': -1,
    'n_jobs': -1
}

# 特征列表
FEATURES = [
    'hour_of_day',
    'day_of_week',
    'is_overtime',
    'worker_count',
    'avg_worker_experience_days',
    'avg_skill_level',
    'temporary_worker_ratio',
    'product_complexity',
    'equipment_age_days',
    'equipment_utilization'
]


class MLModelTrainer:
    """ML模型训练器"""

    def __init__(self, db_config: Dict = None, model_dir: str = MODEL_DIR):
        self.db_config = db_config or DB_CONFIG
        self.model_dir = model_dir
        self.connection = None

    def connect_db(self):
        """连接数据库"""
        if not MYSQL_AVAILABLE:
            raise RuntimeError("PyMySQL 未安装")

        if self.connection is None:
            self.connection = pymysql.connect(**self.db_config)
        return self.connection

    def close_db(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.close()
            self.connection = None

    def load_training_data(self, factory_id: str) -> pd.DataFrame:
        """加载工厂的训练数据"""
        conn = self.connect_db()

        query = """
            SELECT
                hour_of_day,
                day_of_week,
                CAST(is_overtime AS UNSIGNED) as is_overtime,
                worker_count,
                avg_worker_experience_days,
                avg_skill_level,
                temporary_worker_ratio,
                product_complexity,
                equipment_age_days,
                equipment_utilization,
                actual_efficiency,
                actual_duration_hours,
                quality_pass_rate
            FROM scheduling_training_data
            WHERE factory_id = %s
            AND actual_efficiency IS NOT NULL
            ORDER BY recorded_at DESC
        """

        df = pd.read_sql(query, conn, params=[factory_id])
        logger.info(f"加载工厂 {factory_id} 训练数据: {len(df)} 条")
        return df

    def preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """数据预处理"""
        # 处理缺失值
        df = df.fillna({
            'hour_of_day': 12,
            'day_of_week': 3,
            'is_overtime': 0,
            'worker_count': 1,
            'avg_worker_experience_days': 30,
            'avg_skill_level': 2.5,
            'temporary_worker_ratio': 0,
            'product_complexity': 5,
            'equipment_age_days': 365,
            'equipment_utilization': 0.7
        })

        # 转换数据类型
        df['is_overtime'] = df['is_overtime'].astype(int)

        return df

    def train_efficiency_model(self, factory_id: str) -> Dict[str, Any]:
        """训练效率预测模型"""
        if not LIGHTGBM_AVAILABLE:
            return {"success": False, "error": "LightGBM 未安装"}

        try:
            # 加载数据
            df = self.load_training_data(factory_id)

            if len(df) < 50:
                return {
                    "success": False,
                    "error": f"数据不足: {len(df)}/50"
                }

            # 预处理
            df = self.preprocess_data(df)

            # 准备特征和标签
            X = df[FEATURES]
            y = df['actual_efficiency']

            # 划分训练集和测试集
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            # 创建数据集
            train_data = lgb.Dataset(X_train, label=y_train)
            valid_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

            # 训练模型
            model = lgb.train(
                LGBM_PARAMS,
                train_data,
                valid_sets=[valid_data],
                num_boost_round=500,
                callbacks=[lgb.early_stopping(50, verbose=False)]
            )

            # 评估模型
            y_pred = model.predict(X_test)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            r2 = r2_score(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)

            # 保存模型
            version = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_path = os.path.join(
                self.model_dir,
                f"{factory_id}_efficiency_{version}.pkl"
            )
            joblib.dump(model, model_path)

            # 保存特征重要性
            feature_importance = dict(zip(FEATURES, model.feature_importance().tolist()))

            result = {
                "success": True,
                "model_type": "efficiency",
                "version": version,
                "model_path": model_path,
                "training_samples": len(df),
                "rmse": float(rmse),
                "r2_score": float(r2),
                "mae": float(mae),
                "feature_importance": feature_importance,
                "features": FEATURES
            }

            # 保存到数据库
            self._save_model_version(factory_id, "efficiency", result)

            logger.info(f"效率模型训练完成: {result}")
            return result

        except Exception as e:
            logger.error(f"训练效率模型失败: {e}")
            return {"success": False, "error": str(e)}

    def train_duration_model(self, factory_id: str) -> Dict[str, Any]:
        """训练时长预测模型"""
        if not LIGHTGBM_AVAILABLE:
            return {"success": False, "error": "LightGBM 未安装"}

        try:
            df = self.load_training_data(factory_id)

            # 过滤有效数据
            df = df[df['actual_duration_hours'].notna()]

            if len(df) < 50:
                return {"success": False, "error": f"数据不足: {len(df)}/50"}

            df = self.preprocess_data(df)

            X = df[FEATURES]
            y = df['actual_duration_hours']

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            train_data = lgb.Dataset(X_train, label=y_train)
            valid_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

            model = lgb.train(
                LGBM_PARAMS,
                train_data,
                valid_sets=[valid_data],
                num_boost_round=500,
                callbacks=[lgb.early_stopping(50, verbose=False)]
            )

            y_pred = model.predict(X_test)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            r2 = r2_score(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)

            version = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_path = os.path.join(
                self.model_dir,
                f"{factory_id}_duration_{version}.pkl"
            )
            joblib.dump(model, model_path)

            result = {
                "success": True,
                "model_type": "duration",
                "version": version,
                "model_path": model_path,
                "training_samples": len(df),
                "rmse": float(rmse),
                "r2_score": float(r2),
                "mae": float(mae),
                "features": FEATURES
            }

            self._save_model_version(factory_id, "duration", result)

            logger.info(f"时长模型训练完成: {result}")
            return result

        except Exception as e:
            logger.error(f"训练时长模型失败: {e}")
            return {"success": False, "error": str(e)}

    def train_quality_model(self, factory_id: str) -> Dict[str, Any]:
        """训练质量预测模型"""
        if not LIGHTGBM_AVAILABLE:
            return {"success": False, "error": "LightGBM 未安装"}

        try:
            df = self.load_training_data(factory_id)

            df = df[df['quality_pass_rate'].notna()]

            if len(df) < 50:
                return {"success": False, "error": f"数据不足: {len(df)}/50"}

            df = self.preprocess_data(df)

            X = df[FEATURES]
            y = df['quality_pass_rate']

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            train_data = lgb.Dataset(X_train, label=y_train)
            valid_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

            model = lgb.train(
                LGBM_PARAMS,
                train_data,
                valid_sets=[valid_data],
                num_boost_round=500,
                callbacks=[lgb.early_stopping(50, verbose=False)]
            )

            y_pred = model.predict(X_test)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            r2 = r2_score(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)

            version = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_path = os.path.join(
                self.model_dir,
                f"{factory_id}_quality_{version}.pkl"
            )
            joblib.dump(model, model_path)

            result = {
                "success": True,
                "model_type": "quality",
                "version": version,
                "model_path": model_path,
                "training_samples": len(df),
                "rmse": float(rmse),
                "r2_score": float(r2),
                "mae": float(mae),
                "features": FEATURES
            }

            self._save_model_version(factory_id, "quality", result)

            logger.info(f"质量模型训练完成: {result}")
            return result

        except Exception as e:
            logger.error(f"训练质量模型失败: {e}")
            return {"success": False, "error": str(e)}

    def train_all_models(self, factory_id: str,
                         model_types: List[str] = None) -> Dict[str, Any]:
        """训练所有指定类型的模型"""
        if model_types is None:
            model_types = ["efficiency", "duration", "quality"]

        results = {}

        for model_type in model_types:
            if model_type == "efficiency":
                results["efficiency"] = self.train_efficiency_model(factory_id)
            elif model_type == "duration":
                results["duration"] = self.train_duration_model(factory_id)
            elif model_type == "quality":
                results["quality"] = self.train_quality_model(factory_id)

        # 判断整体成功
        success = any(r.get("success", False) for r in results.values())

        return {
            "success": success,
            "factory_id": factory_id,
            "results": results
        }

    def _save_model_version(self, factory_id: str, model_type: str,
                            result: Dict[str, Any]):
        """保存模型版本到数据库"""
        try:
            conn = self.connect_db()
            cursor = conn.cursor()

            # 先将旧模型标记为不活跃
            cursor.execute("""
                UPDATE ml_model_versions
                SET is_active = FALSE, status = 'deprecated'
                WHERE factory_id = %s AND model_type = %s AND is_active = TRUE
            """, (factory_id, model_type))

            # 插入新模型版本
            cursor.execute("""
                INSERT INTO ml_model_versions
                (id, factory_id, model_type, version, training_data_count,
                 rmse, r2_score, mae, model_path, features_json,
                 is_active, status, trained_at)
                VALUES
                (UUID(), %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, 'trained', NOW())
            """, (
                factory_id,
                model_type,
                result.get('version'),
                result.get('training_samples'),
                result.get('rmse'),
                result.get('r2_score'),
                result.get('mae'),
                result.get('model_path'),
                json.dumps(result.get('features', []))
            ))

            conn.commit()
            logger.info(f"模型版本已保存: {factory_id}/{model_type}/{result.get('version')}")

        except Exception as e:
            logger.error(f"保存模型版本失败: {e}")
            conn.rollback()


# ==================== 模型加载器 ====================

class ModelLoader:
    """模型加载器 - 用于预测时加载训练好的模型"""

    def __init__(self, model_dir: str = MODEL_DIR, db_config: Dict = None):
        self.model_dir = model_dir
        self.db_config = db_config or DB_CONFIG
        self.loaded_models: Dict[str, Any] = {}

    def get_model(self, factory_id: str, model_type: str) -> Optional[Any]:
        """获取工厂的指定类型模型"""
        cache_key = f"{factory_id}_{model_type}"

        if cache_key in self.loaded_models:
            return self.loaded_models[cache_key]

        # 从数据库获取模型路径
        model_info = self._get_model_info(factory_id, model_type)
        if not model_info:
            return None

        model_path = model_info.get('model_path')
        if not model_path or not os.path.exists(model_path):
            logger.warning(f"模型文件不存在: {model_path}")
            return None

        try:
            model = joblib.load(model_path)
            self.loaded_models[cache_key] = {
                'model': model,
                'version': model_info.get('version'),
                'r2_score': model_info.get('r2_score'),
                'features': json.loads(model_info.get('features_json', '[]'))
            }
            return self.loaded_models[cache_key]
        except Exception as e:
            logger.error(f"加载模型失败: {e}")
            return None

    def _get_model_info(self, factory_id: str, model_type: str) -> Optional[Dict]:
        """从数据库获取模型信息"""
        try:
            conn = pymysql.connect(**self.db_config)
            cursor = conn.cursor(pymysql.cursors.DictCursor)

            cursor.execute("""
                SELECT version, r2_score, model_path, features_json
                FROM ml_model_versions
                WHERE factory_id = %s AND model_type = %s AND is_active = TRUE
                LIMIT 1
            """, (factory_id, model_type))

            result = cursor.fetchone()
            conn.close()
            return result

        except Exception as e:
            logger.error(f"获取模型信息失败: {e}")
            return None

    def predict(self, factory_id: str, model_type: str,
                features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """使用模型进行预测"""
        model_info = self.get_model(factory_id, model_type)
        if not model_info:
            return None

        try:
            model = model_info['model']
            feature_names = model_info.get('features', FEATURES)

            # 构建特征 DataFrame
            feature_df = pd.DataFrame([features])

            # 确保特征顺序正确
            feature_df = feature_df.reindex(columns=feature_names, fill_value=0)

            prediction = model.predict(feature_df)[0]

            return {
                'prediction': float(prediction),
                'model_version': model_info['version'],
                'r2_score': model_info['r2_score'],
                'confidence': self._calculate_confidence(model_info['r2_score'])
            }

        except Exception as e:
            logger.error(f"预测失败: {e}")
            return None

    def _calculate_confidence(self, r2_score: float) -> float:
        """根据 R² 计算置信度"""
        if r2_score is None:
            return 0.5
        r2 = float(r2_score)
        if r2 >= 0.8:
            return 0.9
        elif r2 >= 0.6:
            return 0.7
        else:
            return 0.5


# ==================== 单例实例 ====================

trainer = MLModelTrainer()
model_loader = ModelLoader()


def train_models(factory_id: str, model_types: List[str] = None) -> Dict[str, Any]:
    """训练模型的便捷函数"""
    return trainer.train_all_models(factory_id, model_types)


def predict_efficiency(factory_id: str, features: Dict[str, Any]) -> Optional[Dict]:
    """预测效率的便捷函数"""
    return model_loader.predict(factory_id, 'efficiency', features)


def predict_duration(factory_id: str, features: Dict[str, Any]) -> Optional[Dict]:
    """预测时长的便捷函数"""
    return model_loader.predict(factory_id, 'duration', features)


def predict_quality(factory_id: str, features: Dict[str, Any]) -> Optional[Dict]:
    """预测质量的便捷函数"""
    return model_loader.predict(factory_id, 'quality', features)
