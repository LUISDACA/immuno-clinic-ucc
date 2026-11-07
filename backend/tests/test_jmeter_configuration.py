"""Guard against reintroducing published targets or literal load-test credentials."""

import json
from pathlib import Path
from xml.etree import ElementTree


def test_load_plan_uses_only_parameterized_synthetic_credentials():
    path = Path(__file__).resolve().parents[2] / "jmeter_tests/ImmunoClinic_LoadTest.jmx"
    root = ElementTree.parse(path).getroot()
    payloads = [
        node.text
        for node in root.iter("stringProp")
        if node.get("name") == "Argument.value" and '"password"' in (node.text or "")
    ]
    assert len(payloads) == 3
    for payload in payloads:
        data = json.loads(payload)
        assert data["password"] in {"${__P(ADMIN_PASSWORD,)}", "${__P(STUDENT_PASSWORD,)}"}
        assert "example.invalid" in data["email"]
    assert "onrender.com" not in path.read_text()
