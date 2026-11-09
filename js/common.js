const NOTICE_CATEGORY_NAMES = {
  GENERAL: "일반",
  IMPORTANT: "중요",
  HR: "인사",
};

// 정의되지 않은 코드는 원래 값을 그대로 보여줍니다.
function getCategoryName(code) {
  return NOTICE_CATEGORY_NAMES[code] || code || "";
}

// "2026-11-09T14:30:15" → "2026-11-09 14:30:15"
function formatDateTime(value) {
  return value ? String(value).replace("T", " ").slice(0, 19) : "";
}

// "2026-11-09T10:30:00" → "2026-11-09"
function formatDate(value) {
  return value ? String(value).slice(0, 10) : "";
}
