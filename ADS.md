# 광고 (Google 애드센스) 설정 안내

광고 자리는 이미 만들어 두었고, `js/firebase-config.js`의 `ADS.enabled`가 `false`인 동안에는 아무것도 보이지 않아요.

광고 자리: 처음 화면 아래 · 기출 풀기 목록 아래 · 채점 결과 화면 · 오답 노트 중간 2곳 · 지도 노트 해설 아래
(문제를 푸는 화면에는 넣지 않았어요 — 애드센스 정책상 실수 클릭을 부르는 자리는 피하는 게 좋아요)

## 1. 개인 도메인 연결 (필수)

애드센스는 `eloyyang.github.io` 같은 하위 주소를 승인하지 않아서 `eloylab.it`(후이즈)을 연결해요.

1. 후이즈 › 도메인 관리 › 네임서버 고급설정(DNS 레코드)
   - `A` 레코드 4개, 호스트 `@`(빈칸) → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` 레코드, 호스트 `www` → `eloyyang.github.io`
2. 저장소의 `CNAME` 파일(`eloylab.it`)을 푸시하면 GitHub Pages에 도메인이 등록돼요. DNS가 먼저 잡힌 뒤에 푸시해야 사이트가 끊기지 않아요
3. GitHub 저장소 › Settings › Pages 에서 Enforce HTTPS 체크 (인증서 발급에 몇 분~1시간)
4. Firebase 콘솔 › Authentication › 설정 › 승인된 도메인에 `eloylab.it` 추가 (안 하면 구글 로그인이 막혀요)

## 2. 애드센스 가입·심사

> 현재: 게시자 ID `ca-pub-3209887784875053` (기존 계정, 비활성 → 다시 활성화 필요). `ADS.client`, `ads.txt`, 각 화면의 `google-adsense-account` 메타 태그에 넣어 둠. 승인되면 `ADS.enabled: true`.


1. https://adsense.google.com 가입 → 사이트에 새 도메인 등록
2. 게시자 ID(`ca-pub-…`)를 알려 주시면 제가 넣을 것
   - `js/firebase-config.js`의 `ADS.client`
   - 사이트 맨 위 `ads.txt` 파일 (`google.com, pub-…, DIRECT, f08c47fec0942fa0`)
   - 심사용 코드
3. 심사 통과(보통 며칠~몇 주) 뒤 `ADS.enabled: true`
4. 애드센스 › 광고 › 광고 단위에서 '디스플레이 광고'를 만들어 단위 ID를 알려 주시면 자리별로 넣을게요 (없으면 하나로 써요)

## 3. 확인할 것

- 개인정보처리방침 페이지(`privacy.html`)의 운영자 이름·연락처를 채워 주세요 (애드센스 심사에 필요)
- 광고는 `ADS.pages`에 적힌 화면에만 나가요 (처음 화면·지도 노트·기출 풀기·오답 노트·소방·지텔프·타자 연습). 기출 문항 이용은 운영자가 확인함(2026-11-16)
- 전체 순서와 홍보 계획은 [MARKETING.md](MARKETING.md)
