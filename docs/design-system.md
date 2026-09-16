# Git Learn 디자인 시스템

네 패널에서 일어나는 하나의 작업을 따라가는 화면이다. 레슨의 지시를 읽고, 변경 파일을 선택하고, 터미널에서 실행하고, 그래프에서 결과를 확인한다. 이 문서는 토스의 시각 언어를 고밀도 개발자 도구에 맞게 번역한 자체 시스템이며 TDS 공식 구현이나 복제물이 아니다.

## 가져온 것과 선택 근거

촘촘한 회색 계단, 명확한 텍스트 위계, 여유 있는 본문 행간, 12–16px 라운드, 옅은 그림자를 가져왔다. 표면보다 내용이 먼저 읽혀야 한다. 흰 패널에 무거운 테두리를 두르는 대신 캔버스와 표면의 밝기 차이로 영역을 구분하고, 입력처럼 조작 가능한 요소만 더 선명한 테두리를 사용한다.

포인트는 블루 한 계열이다. 라이트의 `#1B64DA`는 흰 버튼 문구의 대비를 확보하고, 다크의 `#8BB8FF`는 어두운 표면 위에서 선택과 다음 행동을 드러낸다. 기존 청록은 스테이징 초록과 가까워 행동과 Git 상태가 섞여 보일 수 있으므로 교체했다. 블루는 주요 행동·현재 단계·포커스에 한정한다. 파일 의미색은 별도 축이며 새 브랜드 포인트가 아니다.

한글 본문은 Pretendard를 jsDelivr의 버전 고정 동적 서브셋으로 불러온다. 코드·터미널은 IBM Plex Mono를 유지한다. 기존 서체가 IBM Plex라는 전달 내용을 바탕으로 모노 패밀리를 IBM Plex Mono로 해석했다. CDN을 사용할 수 없으면 시스템 한글 서체와 시스템 모노로 표시되며, 글꼴 요청 실패가 Git 동작을 막지 않는다.

## 무엇을 버렸는가

한 화면에서 한 가지 동작만 하게 하는 금융 앱의 구조를 버렸다. 네 패널을 동시에 읽어야 명령과 저장소 상태의 관계를 배울 수 있기 때문이다. 레슨을 전체 화면으로 바꾸거나 터미널을 숨기는 단계별 마법사는 만들지 않는다.

전체 화면 모달과 큰 히어로도 버렸다. 사용자의 소스·명령·결과를 가리고 작업 기억을 끊는다. 설명은 레슨 패널의 카드, 결과는 패널 내부 상태나 작은 토스트로 전달한다. 오류는 원래 발생한 입력 옆에 남겨 두고 토스트만으로 처리하지 않는다.

큰 버튼과 넓은 여백을 모든 행에 동일하게 적용하는 방식도 버렸다. 기본 버튼은 높이 44px, 파일 정보 행은 최소 40px, 본문은 15px로 유지한다. 32px 제목은 페이지 한 곳에만 쓰고 실제 패널 제목은 15px다. 모든 패널에 경쟁하는 파란 버튼을 넣지 않는다. 과장된 격려, 이모지, 장식용 그라디언트와 반복 애니메이션도 제외한다.

## 파일과 연결 순서

`tokens.css`, `base.css`, `components.css` 순으로 로드한다. Vite 진입점에서 같은 순서로 import하거나 HTML의 stylesheet 링크로 연결할 수 있다. `src/ui/app.ts`도 이 순서로 가져온 뒤 `src/ui/style.css`의 레슨 전용 배치를 적용한다. 앱 스타일에는 별도 토큰 선언이 없으며 색·서체·간격·라운드·그림자는 공통 토큰을 소비한다. `preview.html`은 별도 레슨 엔진 없이 작동하는 스타일 확인 페이지다. 주요 버튼의 피드백 예시, 칩 선택, 테마 전환만 동작하며 Git 실행을 흉내 내거나 저장소 성공을 주장하지 않는다.

테마 속성은 문서 루트 `html`에 둔다. 속성이 없으면 운영체제 설정을 따르고, `data-theme="light"`와 `data-theme="dark"`는 각각 명시적으로 덮어쓴다. 모든 토큰은 먼저 `:root`에 선언한다. 다크에서 달라지는 회색·의미색·그림자는 `prefers-color-scheme: dark`와 `:root[data-theme='dark']`에 동일하게 선언하며, 나머지는 루트 값을 공유한다. `--grey-*`는 테마 적응형 역할 팔레트여서 다크의 숫자는 절대 밝기 순서가 아니다. 실제 UI는 색 원시값보다 `--color-*` 의미 토큰을 사용한다.

## 색 토큰

| 회색 토큰 | 라이트 | 다크 |
| --- | --- | --- |
| `--grey-0` | `#FFFFFF` | `#202632` |
| `--grey-50` | `#F9FAFB` | `#252D3A` |
| `--grey-100` | `#F2F4F6` | `#171C24` |
| `--grey-200` | `#E5E8EB` | `#384252` |
| `--grey-300` | `#D1D6DB` | `#4E5968` |
| `--grey-400` | `#B0B8C1` | `#6B7684` |
| `--grey-500` | `#8B95A1` | `#8B95A1` |
| `--grey-600` | `#6B7684` | `#B0B8C1` |
| `--grey-700` | `#4E5968` | `#D1D6DB` |
| `--grey-800` | `#333D4B` | `#E5E8EB` |
| `--grey-900` | `#191F28` | `#F2F4F6` |
| `--grey-950` | `#101419` | `#FFFFFF` |

| 의미 토큰 | 라이트 | 다크 | 용도 |
| --- | --- | --- | --- |
| `--color-canvas` | grey-100 | grey-100 | 전체 배경 |
| `--color-surface` | grey-0 | grey-0 | 패널·입력 |
| `--color-surface-subtle` | grey-50 | grey-50 | 패널 안 카드 |
| `--color-surface-hover` | grey-100 | grey-100 | 중성 hover |
| `--color-text` | grey-900 | grey-900 | 본문·제목 |
| `--color-text-secondary` | grey-700 | grey-700 | 보조 설명 |
| `--color-text-muted` | `#626D7B` | `#B0B8C1` | 입력 도움말·비활성 문구 |
| `--color-border` | grey-200 | grey-200 | 비조작 영역 구분 |
| `--color-control-border` | `#768391` | `#8290A2` | 입력·보통 버튼 |
| `--color-accent` / `--color-focus` | `#1B64DA` | `#8BB8FF` | 주요 행동·포커스 |
| `--color-accent-hover` | `#1554B8` | `#B2D0FF` | 주요 행동 hover |
| `--color-accent-soft` | `#EAF2FF` | `#243B5E` | 현재 단계·선택 |
| `--color-on-accent` | `#FFFFFF` | `#10213C` | 주요 버튼 글자 |
| `--color-staged` / `-bg` | `#176B45` / `#E8F5ED` | `#8EDDB1` / `#193C2B` | `+ 스테이징됨` |
| `--color-modified` / `-bg` | `#845000` / `#FFF4D6` | `#F0C56C` / `#42341B` | `M 수정됨` |
| `--color-conflict` / `-bg` | `#B42332` / `#FFF0F0` | `#FFABB2` / `#49282E` | `! 충돌`, 이중 테두리 |
| `--color-untracked` / `-bg` | `#4E5968` / `#F2F4F6` | `#D1D6DB` / `#333D4B` | `? 미추적`, 점선 |
| `--color-terminal` | `#0C1319` | 동일 | 항상 어두운 실행 영역 |
| `--color-terminal-text` | `#E5E8EB` | 동일 | 출력 |
| `--color-terminal-muted` | `#B0B8C1` | 동일 | 출력의 보조 정보 |
| `--color-terminal-accent` | `#8BB8FF` | 동일 | 프롬프트·터미널 포커스 |
| `--color-terminal-border` | `#333D4B` | 동일 | 터미널 내부 구분선 |

`-bg`는 위 각 의미 토큰 이름에 붙는 접미사다. 원시 회색 300–500은 일반 본문색으로 쓰지 않는다. 상태마다 텍스트와 기호를 같이 렌더링하고, 기호가 중복 낭독되지 않도록 장식용 기호에는 `aria-hidden="true"`를 둔다. CSS 의사 요소의 내용만으로 상태를 전달하지 않는다.

## 타이포·크기·모션 토큰

| 토큰 | 값 | 적용 |
| --- | --- | --- |
| `--font-sans` | Pretendard → 시스템 sans | 한국어 본문 |
| `--font-mono` | IBM Plex Mono → 시스템 monospace | 코드·경로·SHA·명령 |
| `--text-xs/sm/md/lg/xl/2xl` | 12 / 13 / 15 / 18 / 24 / 32px 상당 rem | 배지 / 코드·보조 / 본문 / 소제목 / 섹션 / 페이지 제목 |
| `--weight-regular/medium/semibold/bold` | 400 / 500 / 600 / 700 | 본문에서 제목 순 |
| `--leading-tight/body/code` | 1.3 / 1.65 / 1.7 | 제목 / 한글 / 코드 |
| `--tracking-title` | -0.025em | 제목만 |
| `--space-0/1/2/3/4/5/6/8/10/12` | 0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px 상당 rem | 의미 단위 간 간격 |
| `--radius-sm/control/panel/pill` | 8 / 12 / 16 / 999px | 배지 / 버튼·카드 / 패널 / 칩 |
| `--shadow-panel` | 0 2px 8px, 라이트 검정 4%·다크 12% | 패널 |
| `--shadow-raised` | 0 8px 24px, 라이트 검정 10%·다크 28% | 토스트 |
| `--duration-fast/normal` | 120 / 180ms | hover 등 상태 전환 |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | 짧은 감속 |
| `--focus-width/offset` | 3 / 3px | 키보드 포커스 |
| `--control-height/row-height` | 44 / 40px 상당 rem | 조작 / 정보 행 최소 높이 |

사용자가 동작 줄이기를 요청하면 모션 토큰은 0ms가 되고 기본 CSS에서 transition과 반복 animation을 억제한다. 화면 진입·깜빡이는 커서·성공 폭죽은 추가하지 않았다. rem을 사용하므로 브라우저 기본 글자 크기에 맞춰 확장된다.

## 컴포넌트 사용 규칙

| 컴포넌트 | 클래스 | 사용 규칙 |
| --- | --- | --- |
| 주요 버튼 | `.button.button--primary` | 현재 작업 묶음의 대표 행동 하나. 44px 최소 높이 |
| 보통 버튼 | `.button.button--secondary` | 대안 행동. 표면색과 선명한 테두리 |
| 조용한 버튼 | `.button.button--quiet` | 보조 행동. 텍스트를 숨기지 않으며 hover·focus 유지 |
| 패널 | `.panel`, `__header`, `__title`, `__body` | 역할별 section과 제목 ID 연결. body 20px |
| 터미널 패널 | `.panel.panel--terminal`, `.terminal-output` | 두 테마 모두 먹색. 내부 프롬프트·보조색은 터미널 전용 토큰 |
| 카드 | `.card`, `__title` | 설명·관련 정보 묶음. 카드 안에 카드를 중첩하지 않음 |
| 배지 | `.badge`, `--staged/modified/conflict/untracked` | 상태 라벨. 색+기호+텍스트. 실제 클릭 대상 아님 |
| 칩 | `.chip` | 브랜치 등 짧은 메타데이터. 선택형은 native button과 `aria-pressed` 사용 |
| 입력 | `.field`, `__label`, `__hint`, `__error`, `.input` | label의 for와 ID 연결. 오류에 `aria-invalid`와 `aria-describedby` 필요 |
| 리스트 | `.list`, `.list-row`, `__label`, `__action` | 경로는 줄바꿈 가능. 행 전체를 가짜 버튼으로 만들지 않음 |
| 진행 | `progress.progress` | native value/max와 연결된 label에 완료 단계 수 명시 |
| 토스트 | `.toast`, `__message` | 새 메시지에 `role=status`, 초점 강탈 금지. 닫기 가능, 짧은 자동 소멸 금지 |

사용 불가는 native `disabled`로 표현한다. 파괴적 작업을 보통 버튼에 섞어 즉시 실행하지 말고 그 작업의 실제 데이터 손실 가능성에 맞춰 확인을 둔다. 이 시스템은 확인 모달이나 Git 명령 실행 로직을 제공하지 않는다. 파일명·명령 출력은 소비 UI에서 `textContent`로 삽입하고 HTML로 해석하지 않는다.

## 고밀도 화면에 적용하는 판단 기준

1440px 안팎의 작업 화면에서 여백의 단위는 전체 화면이 아니라 패널 안의 의미 묶음이다. 패널 간 간격은 16px, 패널 안쪽은 20px, 본문 문장과 행동 사이에는 16px를 둔다. 파일 목록처럼 비교해야 하는 정보는 40px 행으로 이어 놓고 설명 카드에만 충분한 행간을 준다. 짧은 라벨을 과도하게 굵게 만들지 않는다.

시선은 레슨의 현재 할 일에서 파일 상태, 터미널, 그래프로 이동한다. 블루는 현재 단계와 대표 행동만 강조하고 Git 의미색은 작은 상태 배지에 국한한다. 그래프의 브랜치를 여러 브랜드색으로 칠하지 말고 라벨과 선 모양으로 구분한다. 터미널의 어두운 바탕은 실제 작업 영역을 찾는 고정된 기준이다.

좁은 화면에서는 글자를 줄여 네 칸을 억지로 넣지 않는다. 독립 미리보기는 760px 이하에서 동일한 읽기 순서로 네 패널을 세로 배치한다. 실제 앱도 760px 이하에서 레슨 → 소스 컨트롤 → 그래프 → 터미널 순으로 쌓는다. 1200px 이하에서는 오른쪽 작업 영역이 한 열로 바뀌고, 터미널 출력은 내부 세로 스크롤을 유지한다. 확대해도 행의 높이는 고정하지 않아 한글과 긴 파일명이 잘리지 않게 한다.

본문 4.5:1, 조작 경계와 포커스 3:1 이상을 목표로 한다. 색 대비는 실제로 맞닿는 전경·배경 쌍을 확인하며, 전체 색끼리 임의 조합해도 통과한다는 뜻은 아니다. 링크는 밑줄, 현재 단계는 시작선과 텍스트, 오류는 메시지와 굵은 테두리를 함께 쓴다.

## 참고한 공식 자료

[TDS 색상 문서](https://tossmini-docs.toss.im/tds-mobile/foundation/colors/)의 회색과 블루 계열 구성을 참고했다. 이 문서의 수치와 고밀도 적용 규칙은 이 프로젝트에서 정한 값이다. [Pretendard 공식 웹폰트 안내](https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/README.md)의 jsDelivr v1.3.9 동적 서브셋 경로를 사용했다.

## 독립 미리보기 검증 기록 (앱 통합 이전)

2026-09-16, 설치된 Google Chrome을 `agent-browser`의 독립 세션으로 실행해 `http://127.0.0.1:4176/src/styles/preview.html`을 확인했다. 공용 Playwright MCP는 다른 브라우저 세션 사용 중 오류로 열리지 않았고, agent-browser의 기본 Chromium 파일도 없어서 설치된 Chrome 실행 경로를 지정했다. 다른 작업의 브라우저나 서버는 종료하지 않았다.

1440×1080 화면에서 라이트·다크 모두 레슨, 소스 컨트롤, 그래프, 터미널이 동시에 보였다. 흰 패널/어두운 패널의 텍스트와 배지, 입력 오류, 12단계 회색 견본, 전체 78개 토큰 표를 스크린샷으로 확인했다. 터미널은 두 테마 모두 `rgb(12, 19, 25)`였다. Pretendard와 IBM Plex Mono의 실제 FontFace 로딩 상태는 `loaded`였다. 콘솔에는 Vite 연결·CSS 갱신 debug 메시지만 있었고 브라우저 오류는 없었다.

라이트 [작업 화면](../src/styles/preview-light.png)과 [전체 토큰·컴포넌트](../src/styles/preview-light-full.png), 다크 [작업 화면](../src/styles/preview-dark.png)과 [전체 토큰·컴포넌트](../src/styles/preview-dark-full.png)를 저장했다. 캡처는 동작 줄이기가 켜진 상태여서 전체 표의 모션 값은 0ms다. 이미지에서 본 범위는 이 독립 미리보기이며 실제 앱 연결을 확인했다는 뜻은 아니다.

브라우저 계산 색상으로 측정한 본문/표면 대비는 라이트 16.56:1, 다크 13.75:1이다. 주요 버튼은 각각 5.41:1, 7.97:1이고, 네 Git 상태 배지는 라이트 최소 5.80:1, 다크 최소 7.21:1이었다. 보조 문구의 회색 바탕 대비가 처음 4.19:1인 것을 찾아 수정했으며 최종 값은 4.77:1, 흰 바탕에서는 5.26:1이다. 입력 경계/표면은 3.87:1·4.67:1, 포커스/표면은 5.41:1·7.51:1이다. 모든 임의 색 조합이나 소비 UI 전체에 대한 접근성 인증은 아니다.

운영체제 다크 설정에서 시스템 선택은 다크를, 명시적 라이트 선택은 라이트를 표시했다. Tab 이동 시 실제 포커스 outline은 블루 실선 3px이었다. 피드백 버튼으로 토스트가 열리고 닫기 버튼으로 닫혔으며, 선택 칩은 `aria-pressed`가 true에서 false로 바뀌었다. `prefers-reduced-motion` 활성화에서 토큰 0ms와 버튼 transition 0s를 확인했다. 390px 화면에서 한 열로 전환되었고 문서 가로 넘침은 없었다. 화면 리더 실기 검증은 실행하지 않았다.

`npm test`는 현재 공유 작업 트리의 18건을 모두 통과했다(기존 엔진 테스트 10건 포함, 새 테스트 작성 없음). `npm run build`도 TypeScript 검사와 Vite 빌드를 통과했다. 독립 미리보기는 개발 서버 URL로 확인하며, Vite의 별도 HTML 빌드 진입점 등록은 이 변경에 포함하지 않는다. 이 기록은 당시 독립 미리보기 범위이며, 현재 실제 앱 통합 검증은 아래 기록으로 대체한다.


## 실제 앱 통합과 검증 (2026-09-16)

판정: 현재 실제 앱은 `src/styles/preview-light.png`와 같은 디자인 언어로 보인다. 블루 행동색, 중성 회색, Pretendard 본문, 16px 패널 라운드와 옅은 그림자를 공유하며, 실제 긴 레슨과 커밋 이력을 읽기 위해 미리보기의 2×2 대신 왼쪽 레슨·오른쪽 소스/그래프·그 아래 터미널 배치를 유지했다.

`src/ui/style.css`의 청록·자체 다크 팔레트와 중복 기본 스타일을 제거했다. 앱 마크업은 공통 `.panel`, `.panel__header`, `.panel__body`, `.button`, `.input`, `.badge`, `.chip`, `.list-row`, `.progress`, `.card`를 사용한다. 스테이징 영역의 배지는 초록, 수정은 황갈색, 미추적은 중성 점선이며 기존 M/U/D 표기와 접근성 이름을 유지한다. 충돌 토큰과 이중 테두리 배지는 그대로 보존한다. 앱 파일 목록에는 원래 충돌 전용 상태 분류가 없으므로 이번 시각 작업에서 새로운 판별 로직을 만들지 않았다. 충돌·명령 실패는 기존 오류 출력 경로에서 붉은 안내를 받는다.

공통 컴포넌트에 `.button--icon`, `.badge--accent`, `.feedback--success/error/hint`, 코드 블록·인라인 코드, 다이얼로그·백드롭, 스킵 링크를 보강했다. 터미널은 두 테마 모두 먹색이며 버튼·입력·포커스도 터미널 전용 색을 소비한다. 새 토큰은 `--color-terminal-error: #ffabb2`, `--color-terminal-success: #8eddb1`, `--color-backdrop: rgb(12 19 25 / 67%)`이며 모두 테마 불변이다. 앱의 엔진 호출, 이벤트 처리, 채점, 레슨 콘텐츠는 바꾸지 않았다.

가정: 디자인 언어 적용은 정적 시안의 좌표 복제가 아니라 실제 콘텐츠를 같은 시각 규칙으로 표시하는 것으로 해석했다. 따라서 긴 설명은 잘라 숨기지 않고, 긴 브랜치는 헤더에서 줄을 나누거나 말줄임하며 그래프 HEAD 라벨에서 다시 읽을 수 있게 했다. 390px에서는 드롭다운을 별도 행에 놓고 44px 조작 높이와 본문 15px를 유지한다.

Playwright의 실제 Chromium 브라우저에서 `http://127.0.0.1:4173/`를 열어 확인했다. `staging-basics`는 + 버튼·커밋 입력·실제 채점으로 3/3단계를 완료했다. 기존 `src/ui/evidence/play-lessons.js`를 수정 없이 읽어 캡처 경로만 이번 소유 범위로 바꿔 실행했고, 첫 브랜치 4/4, 첫 커밋 5/5, 커밋 쪼개기 4/4, 복구 4/4가 모두 완료되었다. 채점 상태나 완료 DOM을 합성하지 않았다. 이 재생에서 pageerror와 console error는 0건이었다. 기존 테스트 29/29 통과(실패·건너뜀 0), `npm run build`의 TypeScript·Vite 빌드도 통과했으며 새 테스트나 의존성은 추가하지 않았다.

라이트·다크 1440×1100과 모바일 양쪽 테마 390×1100에서 진행·완료 화면을 저장하고 이미지를 직접 확인했다. 진행 화면에는 힌트, 미충족 조건의 붉은 안내, 잘못된 브랜치 명령의 터미널 오류가 들어 있다. 완료 화면은 사라진 커밋 복구 레슨의 실제 4/4 통과와 6개 커밋을 보여 준다. 네 캡처 조건 모두 `scrollWidth === clientWidth`였으며, 스크롤바를 제외한 폭은 데스크톱 1425px·모바일 375px다. 터미널의 계산 배경색은 모두 `rgb(12, 19, 25)`였다.

브라우저에서 보이는 직접 텍스트 노드의 계산 전경색과 가장 가까운 불투명 배경을 비교했다. 진행 화면의 최소 대비는 라이트 4.77:1, 다크 5.58:1로 4.5:1 미만이 없었다. 키보드 Tab 이동 시 힌트 버튼의 실제 포커스는 3px 실선, offset 3px였고, reduced-motion에서는 버튼 transition이 0s였다. Pretendard·IBM Plex Mono의 FontFace는 loaded였다. 드롭다운으로 다섯 레슨을 실제 전환했고, 편집 모달과 잘못된 파일 경로의 앱 오류도 390px에서 확인했다. 화면 리더 실기·다른 브라우저·전체 접근성 인증은 수행하지 않았다.

진행 화면은 [라이트](../src/styles/app-light-progress.png), [다크](../src/styles/app-dark-progress.png), [390px 라이트](../src/styles/app-mobile-light-progress.png), [390px 다크](../src/styles/app-mobile-dark-progress.png)다. 완료 화면은 [라이트](../src/styles/app-light-completed.png), [다크](../src/styles/app-dark-completed.png), [390px 라이트](../src/styles/app-mobile-light-completed.png), [390px 다크](../src/styles/app-mobile-dark-completed.png)다.

추가 증거는 [스테이징·수정·미추적 배지](../src/styles/app-staged.png), [390px 편집기](../src/styles/app-mobile-dark-editor.png), [390px 앱 오류](../src/styles/app-mobile-light-error.png), [첫 브랜치 완료](../src/styles/app-first-branch-completed.png), [첫 커밋 완료](../src/styles/app-first-commit-convention-completed.png), [커밋 분리 완료](../src/styles/app-split-commits-completed.png), [복구 완료](../src/styles/app-force-push-recovery-completed.png)다. 기존 비교용 이미지와 재생 스크립트는 덮어쓰지 않았다.
