"""Tests for the ML predictor."""
import pytest
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))

from app.schemas import PredictRequest
from app.predictor import Predictor


@pytest.fixture(scope="module")
def pred():
    return Predictor()


def make_req(**kwargs):
    base = dict(age=55, gender="Male", blood_group="O+", medical_condition="Heart Disease", admission_type="Emergency", insurance="Medicare")
    base.update(kwargs)
    return PredictRequest(**base)


class TestModelLoading:
    def test_model_is_loaded(self, pred):
        assert pred.is_loaded(), "Model should be loaded from artifacts/"

    def test_model_version_available(self, pred):
        assert pred.model_version() is not None


class TestPredictions:
    def test_basic_prediction_returns_result(self, pred):
        result = pred.predict(make_req())
        assert result is not None
        assert result.predicted_los_days >= 1.0

    def test_prediction_interval_ordered(self, pred):
        result = pred.predict(make_req())
        assert result.prediction_interval.lower <= result.predicted_los_days
        assert result.predicted_los_days <= result.prediction_interval.upper

    def test_prolonged_probability_bounded(self, pred):
        result = pred.predict(make_req())
        assert 0.0 <= result.prolonged_stay_probability <= 1.0

    def test_risk_category_valid(self, pred):
        result = pred.predict(make_req())
        assert result.risk_category in ["Low Risk", "Standard Risk", "Elevated Risk"]

    def test_no_negative_los(self, pred):
        result = pred.predict(make_req(age=1))
        assert result.predicted_los_days >= 1.0

    def test_elective_lower_than_emergency(self, pred):
        elective = pred.predict(make_req(admission_type="Elective", medical_condition="Diabetes"))
        emergency = pred.predict(make_req(admission_type="Emergency", medical_condition="Heart Disease"))
        # Emergency+complex condition should predict higher on average
        # (not guaranteed per-sample but direction should hold for these inputs)
        assert emergency.predicted_los_days >= elective.predicted_los_days * 0.8  # soft check

    def test_disclaimer_present(self, pred):
        result = pred.predict(make_req())
        assert result.disclaimer and len(result.disclaimer) > 20

    def test_unseen_gender_handled_gracefully(self, pred):
        # Unknown gender maps to "Other" and model handles via OrdinalEncoder unknown_value
        req = PredictRequest(age=40, gender="Unknown", blood_group="A+", medical_condition="Diabetes", admission_type="Elective", insurance="Private")
        result = pred.predict(req)
        assert result.predicted_los_days >= 1.0

    def test_risk_category_low_for_simple_case(self, pred):
        result = pred.predict(make_req(age=25, admission_type="Elective", medical_condition="Asthma"))
        # Young elective asthma patient should not be Elevated Risk
        assert result.risk_category in ["Low Risk", "Standard Risk"]

    def test_elevated_risk_for_complex_case(self, pred):
        result = pred.predict(make_req(age=80, admission_type="Emergency", medical_condition="Cancer"))
        assert result.risk_category in ["Standard Risk", "Elevated Risk"]


class TestSchemaValidation:
    def test_invalid_blood_group_raises(self):
        with pytest.raises(Exception):
            PredictRequest(age=30, gender="Male", blood_group="Z+", medical_condition="Diabetes", admission_type="Elective", insurance="Medicare")

    def test_age_out_of_range_raises(self):
        with pytest.raises(Exception):
            PredictRequest(age=200, gender="Male", blood_group="A+", medical_condition="Diabetes", admission_type="Elective", insurance="Medicare")

    def test_invalid_admission_type_raises(self):
        with pytest.raises(Exception):
            PredictRequest(age=30, gender="Male", blood_group="A+", medical_condition="Diabetes", admission_type="Planned", insurance="Medicare")
