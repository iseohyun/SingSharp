# SingSharp Project Architecture & Conventions

## 1. 멀티 플랫폼 모듈형 아키텍처 (Multi-Platform Modular Design)
- **타겟 플랫폼**: Web, Desktop (Tauri / Electron / PWA), Mobile App (Capacitor iOS/Android)
- **기술 스택**: React + TypeScript + Vite
- **레이어 분리 원칙 (Clean Modular Separation)**:
  - `src/core/`: UI 프레임워크에 독립적인 순수 TypeScript 도메인 모듈 (오디오 DSP 피치/세기/바이브레이션 분석, 음역대 테스트 상태 머신, 훈련 시퀀스 생성기, 채점 엔진). 모든 플랫폼에서 100% 재사용한다.
  - `src/types/`: 공통 인터페이스 및 `TrainingSequence` 통합 데이터 스키마 정의 (기초 훈련과 향후 유튜브/외부 음원 실전 훈련이 동일한 데이터 규격을 공유).
  - `src/services/`: 플랫폼 어댑터 및 영속성 레이어 (마이크 스트림 제어, 기준음 신디사이저, 일일 훈련 성과 스토리지).
  - `src/components/`: 재사용 가능한 모듈형 UI 컴포넌트 (오선지 악보 뷰어, 실시간 60fps 피아노 롤 캔버스, 교정 피드백 인디케이터, 일일 성과 대시보드).

## 2. CSS 스타일링 정책 (CSS Styling Architecture)
- **컴포넌트별 모듈형 CSS (`CSS Modules`, `*.module.css`)** 방식을 채택한다.
- 전역 디자인 토큰(색상 팔레트, 피치 상태 컬러, 타이포그래피, 간격 변수)은 `src/styles/variables.css` 및 `src/styles/global.css`에서 관리하며, 개별 컴포넌트 스타일은 각 컴포넌트와 동일한 경로의 `*.module.css`에 캡슐화하여 플랫폼/프로젝트 간 컴포넌트 재사용성을 극대화한다.

## 3. 이원화 버전 관리 및 캐시 버스팅 정책 (Dual Versioning & Cache-Busting)
- `src/version.ts` 파일을 통해 **정식 시맨틱 버전(`APP_VERSION`, SemVer)**과 **일자 기반 캐시 버스팅 빌드 태그(`BUILD_TAG`, `YYYYMMDDvN`)**를 이원화하여 관리한다.
- **정식 버전 (`APP_VERSION`)**: 사용자의 명시적인 버전 업그레이드 승인이 있을 때만 변경한다 (초기값 `0.1.0`).
- **캐시 버스팅 태그 (`BUILD_TAG`)**: 코드 수정 및 기능 업데이트 시마다 당일 날짜 기준 `YYYYMMDDvN` (예: `20261106v1`, `20261106v2`...) 형태로 자동 갱신하며, UI 헤더/푸터 및 빌드 메타데이터에 노출하여 강제 새로고침 없이도 최신 번들 적용 여부를 즉시 확인할 수 있도록 한다.
