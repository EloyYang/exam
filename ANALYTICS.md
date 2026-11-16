# 이용 기록으로 인사이트 얻기

사이트는 Google 애널리틱스 4(GA4)에 이용 기록을 보낸다. 코드는 `js/analytics.js`, 설정은 `js/firebase-config.js`의 `window.ANALYTICS`.

- 보는 곳: <https://analytics.google.com> → 계정의 `study-notes-80ece` 속성 (Firebase 콘솔 › 애널리틱스에서도 열린다)
- 측정 ID: `G-FXS8VPXXJV`
- 이름·이메일·계정 ID·고른 답·메모는 보내지 않는다. 시험 종류, 회차, 점수, 걸린 시간만 보낸다.

## 처음 한 번 해 둘 설정

1. **내 방문 빼기** — 내가 쓰는 기기마다 `https://eloylab.it/?notrack=1`을 한 번 연다. (다시 켜기는 `?notrack=0`)
2. **맞춤 측정기준 등록** — GA4 › 관리 › 맞춤 정의 › 맞춤 측정기준 만들기. 범위는 모두 '이벤트'. 등록한 뒤부터 보고서에서 고를 수 있다.

   | 이름 | 이벤트 매개변수 |
   |---|---|
   | 시험 | `exam_name` |
   | 화면(탭) | `screen` |
   | 풀이 종류 | `quiz_type` |
   | 회차·시험지 | `quiz_id` |
   | 영역 | `section` |

   맞춤 측정항목(범위 '이벤트', 단위 '표준')도 등록: `score`, `minutes`, `wrong_count`, `days_to_exam`.
3. **주요 이벤트 지정** — 관리 › 이벤트에서 `quiz_complete`, `login`을 '주요 이벤트'로 표시. 유입 경로별로 "실제로 끝까지 푼 사람"을 볼 수 있다.
4. **페이지 변경 중복 끄기** — 관리 › 데이터 스트림 › 웹 스트림 › 향상된 측정 › 페이지 조회 › 고급 설정에서 '브라우저 기록 이벤트에 따른 페이지 변경'을 끈다. (탭 이동은 코드가 직접 센다)
5. **데이터 보관 기간** — 관리 › 데이터 보관에서 2개월 → 14개월.
6. **검색 유입 보기** — [Google Search Console](https://search.google.com/search-console)에 사이트를 등록하고 GA4와 연결하면 어떤 검색어로 들어오는지 보인다. 네이버는 [서치어드바이저](https://searchadvisor.naver.com).

## 보내는 이벤트

| 이벤트 | 언제 | 주요 값 |
|---|---|---|
| `page_view` | 화면·탭을 열 때 | `exam_name`, `page_name`, `screen` |
| `quiz_start` | 회차·모의고사·기출 풀이를 시작할 때 | `quiz_type`, `quiz_id` |
| `quiz_complete` | 채점했을 때 | `score`, `wrong_count`, `minutes`, `retake`, `days_to_exam` |
| `passage_complete` | 지텔프 독해·청취 한 세트를 채점했을 때 | `section`, `quiz_id`, `score` |
| `practice` | 문법·단어·타자·오답 다시 풀기를 쓴 방문(방문당 1번) | `section` |
| `note_write` / `flag_question` / `wrong_mastered` | 메모, ★ 표시, 오답 '외움' 처리를 쓴 방문 | |
| `set_create` | 한국사 맞춤 문제 세트를 만들었을 때 | |
| `plan_start` | 지텔프 10일 플랜 시작 | |
| `dday_set` | 시험일을 정했을 때 | `days_to_exam` |
| `login` / `logout` | Google 로그인·로그아웃 | |
| `js_error` | 화면에서 오류가 났을 때 | `message`, `source` |

모든 이벤트에 `exam`, `exam_name`, `content_group`(= 시험 이름)이 붙는다. `quiz_type`은 `round`(한국사 회차), `custom_set`, `mock`(지텔프 모의고사), `past_exam`(소방 기출).

## 질문별로 볼 곳

**마케팅**

| 알고 싶은 것 | 보는 곳 |
|---|---|
| 어디서 들어오나 (검색·카페·카톡 등) | 보고서 › 획득 › 트래픽 획득 |
| 어느 경로의 방문자가 실제로 문제를 푸나 | 같은 보고서에서 '주요 이벤트' 열 (`quiz_complete`) |
| 홍보 글마다 효과가 다른가 | 링크에 `?utm_source=naver_cafe&utm_medium=post&utm_campaign=fire2027`처럼 붙여 올리고, 트래픽 획득에서 '세션 캠페인'으로 비교 |
| 어떤 시험의 수요가 큰가 | 보고서 › 참여도 › 페이지 및 화면에서 측정기준을 '콘텐츠 그룹'으로 |
| 시험 며칠 전에 몰리나 | 탐색 분석에서 `quiz_complete`의 `days_to_exam` 분포. 홍보 시점을 정하는 근거 |
| 다시 오나 | 보고서 › 유지 (재방문율, 동질 집단) |
| 휴대폰인가 컴퓨터인가 | 보고서 › 기술 › 개요 |

**개선**

| 알고 싶은 것 | 보는 곳 |
|---|---|
| 풀다가 그만두는 비율 | 탐색 분석 › 유입경로: `page_view` → `quiz_start` → `quiz_complete`, 시험별로 나눠 보기 |
| 어느 회차·시험지가 많이 풀리나, 어디가 어려운가 | `quiz_complete`를 `quiz_id`별로: 횟수, 평균 `score`, 평균 `minutes` |
| 안 쓰이는 기능 | `practice`의 `section`별 사용자 수, `note_write`·`flag_question`·`set_create` 사용자 수. 낮으면 위치를 바꾸거나 뺀다 |
| 로그인하게 되는 비율 | `login` 사용자 수 ÷ 전체 사용자 수 |
| 처음 화면에서 바로 나가나 | 페이지 및 화면에서 `index`의 참여율, 평균 참여 시간 |
| 깨지는 화면 | `js_error`를 `message`·`source`별로 |

## 확인과 끄기

- 지금 들어오는지: GA4 › 보고서 › 실시간. 표준 보고서는 하루쯤 뒤에 채워진다.
- 어떤 이벤트가 나가는지: 주소 뒤에 `?track_debug=1`을 붙이고 브라우저 콘솔을 본다.
- `localhost`에서는 보내지 않는다.
- 전부 끄기: `window.ANALYTICS.enabled`를 `false`로.
- 방문자는 개인정보처리방침의 버튼으로 자기 브라우저의 수집을 끌 수 있다.
