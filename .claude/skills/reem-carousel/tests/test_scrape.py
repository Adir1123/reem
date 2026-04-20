"""Unit tests for scrape_transcripts — segment normalisation and error paths."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from scripts.scrape_transcripts import _segments_to_text, scrape_one


def test_segments_pintostudio_flat_shape():
    items = [
        {"text": "hello", "start": 0.0, "dur": 1.2},
        {"text": "world", "start": 1.2, "dur": 1.5},
    ]
    assert _segments_to_text(items) == "hello\nworld"


def test_segments_pintostudio_data_envelope():
    """Real actor shape: one item with a 'data' array of segments."""
    items = [{"data": [
        {"start": "3.4", "dur": "4.6", "text": "hello everyone"},
        {"start": "8.0", "dur": "4.6", "text": "makeing bank here"},
    ]}]
    assert _segments_to_text(items) == "hello everyone\nmakeing bank here"


def test_segments_transcript_shape():
    items = [{"transcript": "full video text here"}]
    assert _segments_to_text(items) == "full video text here"


def test_segments_captions_shape():
    items = [{"captions": [{"text": "a"}, {"text": "b"}]}]
    assert _segments_to_text(items) == "a\nb"


def test_segments_empty():
    assert _segments_to_text([]) == ""
    assert _segments_to_text(None) == ""


def test_segments_skips_junk():
    items = [{"text": ""}, {"unknown_field": 1}, {"text": "real"}]
    assert _segments_to_text(items) == "real"


def test_scrape_one_happy_path():
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = {"defaultDatasetId": "ds1"}
    mock_client.dataset.return_value.iterate_items.return_value = iter([
        {"text": "alpha"},
        {"text": "bravo"},
    ])

    r = scrape_one(mock_client, "https://youtube.com/watch?v=x")
    assert r["url"] == "https://youtube.com/watch?v=x"
    assert r["transcript"] == "alpha\nbravo"
    assert r["transcript_chars"] == len("alpha\nbravo")
    assert r["segment_count"] == 2


def test_scrape_one_raises_on_empty_transcript():
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = {"defaultDatasetId": "ds1"}
    mock_client.dataset.return_value.iterate_items.return_value = iter([])
    with pytest.raises(RuntimeError, match="Empty transcript"):
        scrape_one(mock_client, "https://youtube.com/watch?v=x")


def test_scrape_one_raises_on_missing_dataset():
    mock_client = MagicMock()
    mock_client.actor.return_value.call.return_value = {}
    with pytest.raises(RuntimeError, match="missing dataset"):
        scrape_one(mock_client, "https://youtube.com/watch?v=x")
