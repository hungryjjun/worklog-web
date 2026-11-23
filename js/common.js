const NOTICE_CATEGORY_NAMES = {
  GENERAL: "일반",
  IMPORTANT: "중요",
  HR: "인사",
};

// 목록 검색대상. 화면에는 한글, 서버에는 코드를 보냅니다. 첫 항목(ALL)이 기본값입니다.
const NOTICE_SEARCH_TYPE_NAMES = {
  ALL: "제목+내용",
  TITLE: "제목",
  CONTENT: "내용",
};

// 오류 응답 { message, errors: [{ field, message }] }에서 화면에 보여줄 문구를 꺼냅니다.
// 항목별 메시지("검색어는 20자 이하로 입력해 주세요.")가 더 구체적이므로 먼저 씁니다.
// 본문이 JSON이 아니면(프록시 오류 화면 등) null을 돌려줍니다.
async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body?.errors?.[0]?.message || body?.message || null;
  } catch {
    return null;
  }
}

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
