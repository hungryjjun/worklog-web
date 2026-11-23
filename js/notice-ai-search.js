// 문장 질문 → 서버(AI)가 검색 조건 추출 → 그 조건을 검색창에 채우고 notice-list.js의 일반 검색 실행
// notice-list.js의 goToList, readListParams, DEFAULT_PAGE, DEFAULT_SEARCH_TYPE를 사용하므로 그 뒤에 로드합니다.

const AI_FAILURE_MESSAGE = "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.";
const AI_BUTTON_TEXT = "AI로 찾기";
const AI_SEARCHING_TEXT = "찾는 중...";

// 서버 condition.period 값 → 화면 표시
const AI_PERIOD_NAMES = {
  TODAY: "오늘",
  THIS_YEAR: "올해",
  LAST_YEAR: "작년",
};

const aiSearchForm = document.getElementById("noticeAiSearchForm");
const aiQuestionInput = document.getElementById("noticeAiQuestion");
const aiSearchButton = document.getElementById("noticeAiSearchButton");
const aiSearchMessage = document.getElementById("noticeAiSearchMessage");

// 마지막 AI 요청 번호입니다. 요청 중에 사용자가 목록을 이동하면 번호를 올려, 늦게 온 응답을 버립니다.
let latestAiRequestId = 0;

async function searchWithAi() {
  // 버튼이 비활성이면 Enter도 submit되지 않지만, 혹시 모를 중복 요청을 한 번 더 막습니다.
  if (aiSearchButton.disabled) {
    return;
  }

  const question = aiQuestionInput.value.trim();
  if (question === "") {
    showAiMessage("질문을 입력해 주세요.", { isError: true });
    aiQuestionInput.focus();
    return;
  }

  const requestId = ++latestAiRequestId;
  hideAiMessage();
  setAiSearching(true);

  try {
    // $.ajax({ type: "POST", contentType: "application/json", data: JSON.stringify(...) })와 같습니다.
    // fetch는 객체를 알아서 JSON으로 바꾸지 않으므로 body와 Content-Type을 직접 지정합니다.
    const response = await fetch(`${API_BASE_URL}/notices/ai-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    // $.ajax라면 400/502는 error 콜백으로 가지만, fetch는 상태 코드를 직접 나눠야 합니다.
    if (!response.ok) {
      const message = response.status === 400
        ? (await readErrorMessage(response)) ?? "질문을 확인해 주세요."
        : AI_FAILURE_MESSAGE; // 502(AI 실패)와 그 밖의 서버 오류
      if (requestId === latestAiRequestId) {
        showAiMessage(message, { isError: true });
      }
      return;
    }

    const data = await response.json();
    if (requestId !== latestAiRequestId) {
      return; // 기다리는 사이 사용자가 직접 검색·초기화·이동했으므로 사용자의 선택을 덮어쓰지 않습니다.
    }

    // 조건을 하나도 못 뽑으면 서버는 condition 없이 message만 줍니다.
    if (data.condition == null) {
      showAiMessage(data.message ?? "검색 조건을 찾지 못했습니다.", { isError: true });
      return;
    }

    applyAiCondition(data.condition);
  } catch (error) {
    if (requestId !== latestAiRequestId) {
      return;
    }
    // 서버가 꺼져 있거나 네트워크가 끊긴 경우입니다. fetch는 이때만 오류를 던집니다.
    console.error("AI 검색 실패:", error);
    showAiMessage(AI_FAILURE_MESSAGE, { isError: true });
  } finally {
    // 응답을 버린 경우에도 요청은 끝났으므로 버튼은 되돌립니다.
    setAiSearching(false);
  }
}

// 서버 응답의 result는 쓰지 않고 일반 검색을 다시 실행합니다.
// 사용자가 고른 페이지 크기를 지키고, 조건을 주소에 남겨 새로고침·뒤로가기를 유지하기 위해서입니다.
function applyAiCondition(condition) {
  // null인 값은 빈 칸으로 채웁니다. 기간이 없으면(from/to null) 날짜를 비워 전체 기간을 검색합니다.
  // goToList → showListFromUrl이 주소를 검사(readListParams)한 뒤 검색창을 채웁니다.
  goToList({
    category: condition.category ?? "",
    searchType: condition.searchType ?? DEFAULT_SEARCH_TYPE,
    keyword: condition.keyword ?? "",
    from: condition.from ?? "",
    to: condition.to ?? "",
    page: DEFAULT_PAGE,
    size: readListParams().size,
  });

  // goToList가 보낸 noticelistnavigate 이벤트가 안내를 지우므로, 이동한 뒤에 표시합니다.
  showAiMessage(`이렇게 이해했어요: ${describeCondition(condition)}`);
}

// { category: "HR", keyword: "휴가", searchType: "TITLE", period: "THIS_YEAR", from, to }
// → "구분 인사 · 검색어 '휴가'(제목) · 기간 올해(2026-01-01 ~ 2026-12-31)"
function describeCondition({ category, keyword, searchType, period, from, to }) {
  const parts = [];

  if (category) {
    parts.push(`구분 ${getCategoryName(category)}`);
  }
  if (keyword) {
    const typeName = NOTICE_SEARCH_TYPE_NAMES[searchType] ?? NOTICE_SEARCH_TYPE_NAMES[DEFAULT_SEARCH_TYPE];
    parts.push(`검색어 '${keyword}'(${typeName})`);
  }

  if (from || to) {
    const range = from === to ? from : `${from ?? ""} ~ ${to ?? ""}`; // 오늘은 날짜 하나만
    const periodName = AI_PERIOD_NAMES[period];
    parts.push(periodName ? `기간 ${periodName}(${range})` : `기간 ${range}`);
  } else {
    // 질문에 기간이 없어 날짜 칸을 비웠다는 것을 알려 줍니다.
    parts.push("기간 전체");
  }

  return parts.join(" · ");
}

// 요청 중에는 버튼을 막고 글자를 바꿉니다. (jQuery의 .prop("disabled", true).text("찾는 중..."))
function setAiSearching(isSearching) {
  aiSearchButton.disabled = isSearching;
  aiSearchButton.textContent = isSearching ? AI_SEARCHING_TEXT : AI_BUTTON_TEXT;
}

// 서버·AI가 준 문구도 textContent로만 넣습니다. 태그가 섞여 와도 글자로 보입니다. (jQuery의 .text())
function showAiMessage(text, { isError = false } = {}) {
  aiSearchMessage.textContent = text;
  aiSearchMessage.classList.toggle("is-error", isError);
  aiSearchMessage.hidden = false;
}

function hideAiMessage() {
  aiSearchMessage.textContent = "";
  aiSearchMessage.hidden = true;
}

aiSearchForm.addEventListener("submit", (event) => {
  event.preventDefault(); // 폼의 기본 동작인 페이지 이동(새로고침)을 막습니다.
  searchWithAi();
});

// 일반 검색, 초기화, 페이지 이동, 뒤로가기 때 notice-list.js가 보냅니다.
// 기다리던 AI 응답을 무효로 하고, 지금 화면과 맞지 않게 된 "이렇게 이해했어요"를 지웁니다.
document.addEventListener("noticelistnavigate", () => {
  latestAiRequestId++;
  hideAiMessage();
});
