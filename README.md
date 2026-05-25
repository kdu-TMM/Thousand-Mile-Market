# Thousand-Mile-Market (천리마켓)

Spring Boot 3.5 + Firebase Firestore + Redis 기반 중고거래 플랫폼

---

## 🚀 팀원 로컬 환경 세팅 순서

### 1. 레포 클론 / 풀

```bash
git clone https://github.com/kdu-TMM/Thousand-Mile-Market.git
# 이미 클론한 경우
git pull origin main
```

---

### 2. Firebase 서비스 계정 키 배치 ⚠️ 필수

Firebase 키는 보안상 Git에 포함되지 않습니다.  
**팀장에게 `firebase-service-account.json` 파일을 받아서** 아래 경로에 그대로 넣으세요.

```
TMM/src/main/resources/firebase-service-account.json
```

> `.gitignore`에 등록되어 있어 실수로 커밋되지 않습니다.

---

### 3. Docker Desktop 설치 (처음 한 번만)

Redis는 Docker로 실행합니다. **Docker Desktop이 없으면 아래 링크에서 설치하세요.**

| OS | 다운로드 |
|----|---------|
| Windows | https://docs.docker.com/desktop/setup/install/windows-install/ |
| Mac | https://docs.docker.com/desktop/setup/install/mac-install/ |

설치 후 **Docker Desktop 앱을 실행**해 두세요 (트레이에 고래 아이콘이 떠야 함).

---

### 4. Redis 컨테이너 실행

프로젝트 루트(`docker-compose.yml`이 있는 위치)에서 실행합니다.

```bash
# 프로젝트 루트에서
docker-compose up -d
```

정상 실행 확인:

```bash
docker ps
```

아래처럼 `tmm-redis` 컨테이너가 보이면 OK입니다.

```
CONTAINER ID   IMAGE            STATUS          NAMES
xxxxxxxxxxxx   redis:7-alpine   Up X seconds    tmm-redis
```

---

### 5. Redis Pub/Sub 활성화 (경매 SSE 기능)

`TMM/src/main/resources/application.properties` 파일에서 아래 값을 변경합니다.

```properties
# Docker Redis가 실행 중일 때 true 로 변경
app.redis.pubsub.enabled=true
```

> ⚠️ **이 파일은 커밋하지 마세요.** 본인 로컬 설정입니다.  
> (추후 `.gitignore` 처리 예정)

---

### 6. 서버 실행

```bash
cd TMM
./gradlew bootRun
```

접속: [http://localhost:9090](http://localhost:9090)

---

## ✅ 정상 시작 로그 확인 포인트

```
Firebase 키 로드: classpath:/firebase-service-account.json
Firebase Admin SDK 초기화 완료 (project: thousand-mile-market)
Redisson 3.32.0
Started TmmApplication in X.XXX seconds
[서버 시작] Firestore의 경매들을 스케줄러에 다시 등록합니다...
```

---

## 🐳 Docker 명령어 요약

```bash
docker-compose up -d      # Redis 백그라운드 실행
docker-compose down       # Redis 중지
docker ps                 # 실행 중인 컨테이너 확인
docker-compose logs -f    # 로그 실시간 보기
```

---

## ❓ Redis 없이 서버만 켜고 싶다면

`application.properties`에서:

```properties
app.redis.pubsub.enabled=false   # 기본값
```

이 상태로도 서버는 정상 시작됩니다.  
단, **경매 실시간 입찰(SSE)** 기능은 동작하지 않습니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Spring Boot 3.5, Java 17, Gradle |
| 뷰 | Thymeleaf SSR |
| DB (경매) | Firebase Firestore (Admin SDK) |
| DB (상품·채팅·유저) | Firebase Firestore (Client SDK) |
| Cache / 동시성 | Redis + Redisson 3.32.0 (Lua 스크립트) |
| 실시간 | SSE (Server-Sent Events) + Redis Pub/Sub |
| 인프라 | Docker Compose (Redis) |
