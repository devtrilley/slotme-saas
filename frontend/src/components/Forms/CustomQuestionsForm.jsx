// CustomQuestionsForm.jsx
import React, { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import { API_BASE } from "../../utils/constants";

export default function CustomQuestionsForm() {
  const [questions, setQuestions] = useState([]);
  const [enabled, setEnabled] = useState(true); // Optional toggle
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/freelancer/questions`)
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data.questions)) {
          setQuestions(data.questions);
          setEnabled(data.enabled ?? true); // ← load from backend
        }
      })
      .catch(() => showToast("Failed to load questions", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = (index, key, value) => {
    const updated = [...questions];
    updated[index][key] = value;
    setQuestions(updated);
  };

  const handleAdd = () => {
    setQuestions([...questions, { question: "", required: false }]);
  };

  const handleDelete = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleSave = () => {
    axios
      .patch(`${API_BASE}/freelancer/questions`, {
        custom_questions: questions,
        custom_questions_enabled: enabled, // ← send to backend
      })
      .then(() => showToast("Questions saved ✅"))
      .catch(() => showToast("Failed to save questions", "error"));
  };

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-purple-600"
        />
        <span className="text-sm text-gray-200">Enable custom questions</span>
      </label>

      {questions.map((item, index) => (
        <div
          key={index}
          className="rounded-md border border-gray-700 bg-gray-900 p-4 space-y-2"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400 uppercase tracking-wide">
                Question {index + 1}
              </label>
              <textarea
                rows={2}
                value={item.question}
                onChange={(e) =>
                  handleUpdate(index, "question", e.target.value)
                }
                placeholder="e.g. Do you have any allergies?"
                className="w-full resize-none text-sm rounded-md px-3 py-2 bg-[#111216] text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => handleDelete(index)}
              className="text-sm text-red-400 hover:text-red-300 mt-6"
              aria-label="Delete question"
            >
              ✕
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 pt-1">
            <input
              type="checkbox"
              checked={item.required}
              onChange={(e) =>
                handleUpdate(index, "required", e.target.checked)
              }
              className="accent-purple-600"
            />
            <span>Required</span>
          </label>
        </div>
      ))}

      <div className="flex gap-2 justify-center">
        <button
          onClick={handleAdd}
          className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
        >
          + Add Question
        </button>
        <button
          onClick={handleSave}
          className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
        >
          Save Question
        </button>
      </div>
    </div>
  );
}
