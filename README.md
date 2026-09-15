# 그려서 배워요! 🏫✏️

![그려서 배워요! 소개 영상](./docs/images/intro.gif)

칠판에 그림을 그리고 친구들이 맞히는 **초등 교육용 실시간 그림 퀴즈 게임**입니다.
AI 펭수가 제시어를 내고, 오답을 격려하고, 힌트를 주고, 정답자를 축하하며 쉬운 설명을 들려줍니다.

- 기술: Next.js 16 (App Router) · Neon PostgreSQL · OpenAI API · Vercel
- 기획 문서: [PRD.md](./PRD.md)

## 주요 기능

- **회원가입 없이 바로 참여** — 닉네임만 입력하고 6자리 방 코드나 초대 링크로 입장 (3~10명)
- **교과 주제 × 학년 난이도** — 역사·사회·과학·문학·영어·수학·예체능 7개 주제, 쉬움(1~2학년)·보통(3~4학년)·어려움(5~6학년)
- **AI 펭수** — 제시어 출제, 오답 격려, 오답 5개마다 힌트, 정답자 축하와 "알고 가요!" 쉬운 설명
- **분필 칠판** — 분필 색·굵기·지우개·되돌리기, 그리는 과정이 친구들 화면에 실시간으로 보여요
- **알림장 채팅** — 채팅으로 정답을 외치고, 맞힌 친구가 다음 출제자(리더)가 돼요
- **NPC 로봇 친구** — 사람이 부족하면 로봇 친구를 넣어 함께 맞히고 그림도 그려요
- **점수·순위** — 5문제 × 3주제 = 1라운드, 3라운드까지 라운드별·최종 순위 발표

## 화면 미리보기

| 홈 (교실 입장하기) | 대기실 |
| --- | --- |
| ![홈 화면](./docs/images/home.png) | ![대기실 화면](./docs/images/lobby.png) |
| **주제·난이도 고르기** | **칠판에 그리기** |
| ![주제 선택 화면](./docs/images/topic.png) | ![그리기 화면](./docs/images/game.png) |
| **정답 발표 · 펭수 설명** | |
| ![정답 발표 화면](./docs/images/reveal.png) | |

## Vercel + Neon 배포 방법

1. **GitHub에 올리기**
   이 폴더를 GitHub 저장소로 push 합니다. (`.env.local`은 `.gitignore`에 포함되어 올라가지 않아요.)

2. **Vercel 프로젝트 만들기**
   [vercel.com](https://vercel.com) → *Add New… → Project* → 저장소 선택 → Framework는 자동으로 Next.js.

3. **Neon 연결**
   Vercel 프로젝트 → *Storage* 탭 → *Create Database* → **Neon** 선택 → 프로젝트에 연결.
   `DATABASE_URL` 환경 변수가 자동으로 등록됩니다. 테이블은 첫 요청 때 자동으로 만들어져요.

4. **OpenAI 키 등록**
   Vercel 프로젝트 → *Settings → Environment Variables* 에 추가:

   | 이름 | 값 |
   | --- | --- |
   | `OPENAI_API_KEY` | `sk-...` (필수) |
   | `OPENAI_MODEL` | `gpt-4.1-mini` (선택, 기본값) |
   | `MIN_PLAYERS` | `3` (선택, 시작 최소 인원) |

5. **Deploy** (환경 변수를 나중에 넣었다면 *Redeploy*).

> **리전 맞추기:** `vercel.json`에서 서버 함수 리전을 싱가포르(`sin1`)로 정해 두었어요.
> Neon 데이터베이스를 만들 때도 **AWS Asia Pacific (Singapore)** 를 고르면 DB 왕복이 짧아져 그림 동기화가 빨라요.
> 다른 리전의 Neon을 쓴다면 `vercel.json`의 `regions` 값도 그 근처로 바꿔 주세요.

### Vercel CLI로 바로 배포하기 (GitHub 없이)

```bash
npm i -g vercel        # 처음 한 번
vercel login           # 처음 한 번
npm run deploy:preview # 미리보기 배포 (프로젝트 연결 질문에 답하기)
vercel env add OPENAI_API_KEY   # 키 등록 (Production/Preview 선택)
npm run deploy         # 실제(Production) 배포
```

Neon 연결은 Vercel 대시보드의 *Storage* 탭에서 하면 `DATABASE_URL`이 자동 등록돼요.
`.vercelignore` 덕분에 `.env.local`(API 키)은 업로드되지 않아요.

### 배포 관련 파일

| 파일 | 역할 |
| --- | --- |
| `vercel.json` | Next.js 프레임워크, 빌드 명령, 함수 리전(`sin1`), API 캐시 끄기 |
| `.vercelignore` | CLI 업로드 시 비밀 키·빌드 결과 제외 |
| `.env.example` | 필요한 환경 변수 목록 |
| `db/schema.sql` | Neon 테이블 스키마 (자동 생성되지만 SQL Editor에서 미리 실행 가능) |

## 로컬에서 실행

```bash
npm install

# 1) DB 없이 바로 체험 (내장 PGlite 사용, 서버를 끄면 데이터 초기화)
npm run dev:local

# 2) 실제 Neon DB 사용 — .env.local 에 DATABASE_URL 추가 후
npm run dev
```

`.env.local` 예시는 [.env.example](./.env.example) 참고. 혼자 테스트할 때는 `MIN_PLAYERS=1`,
시간을 짧게 하려면 `GAME_TIME_SCALE=0.2`(제한 시간 1/5)를 넣으면 편해요. 브라우저 창 여러 개(시크릿 창 포함)로 여러 명을 흉내 낼 수 있어요.

## 소개 영상 (Remotion)

맨 위 GIF는 `video/` 폴더의 [Remotion](https://www.remotion.dev) 프로젝트로 만든 40초 소개 영상이에요.

```bash
cd video
npm install
npm run studio   # 브라우저에서 미리보기·수정
npm run render   # out/intro.mp4 (1920×1080, 30fps)
```

장면 길이는 `video/src/theme.ts`, 각 장면은 `video/src/scenes/`에 있어요.
> Remotion은 개인·직원 3명 이하 회사는 무료, 그 외 회사·기관은 [회사 라이선스](https://www.remotion.dev/license)가 필요해요.

## 펭수 이미지

`public/pengsoo.png`가 AI 펭수 아바타로 쓰입니다. 파일을 바꾸면 이미지가 바뀌고, 파일이 없으면 기본 펭귄 그림이 나와요.

## 구조

```
src/
  app/
    page.tsx                  홈 (닉네임, 방 만들기/참가)
    room/[code]/page.tsx      게임 방
    api/rooms/...             방 생성·입장·상태·주제·그림·채팅·다음·나가기 API
  components/
    RoomClient.tsx            게임 화면 (폴링, 출석부, 칠판, 알림장 채팅, 순위)
    Board.tsx                 칠판 캔버스 + 분필 도구
    Pengsoo.tsx               AI 펭수 아바타·말풍선
  lib/
    game.ts                   게임 진행 엔진 (상태 전이, 점수, 힌트, 정답 판정)
    words.ts                  OpenAI 제시어·힌트·설명 생성 (+ 실패 시 내장 단어장)
    pengsoo.ts                펭수 페르소나, 격려/축하 문장
    db.ts                     Neon 드라이버 (로컬은 PGlite)
    topics.ts                 주제·난이도·규칙 상수
    npc.ts                    NPC 로봇 친구 (맞히기·AI 그림 그리기)
    wordbank.ts               내장 단어장 (AI 실패 시 사용)
db/schema.sql                 Neon 테이블 스키마
docs/images/                  README 화면 캡처·소개 GIF
video/                        Remotion 소개 영상 프로젝트
```

## 실시간 동기화 방식과 사용량

Vercel 함수는 WebSocket을 유지할 수 없어서, 브라우저가 0.6~1.2초마다 `/state`를 호출해 새 그림·채팅만 받아옵니다.
10명이 1시간 플레이하면 대략 5~6만 번의 함수 호출이 생기므로, 학교에서 자주 쓴다면 Vercel Pro 요금제를 권장합니다.
