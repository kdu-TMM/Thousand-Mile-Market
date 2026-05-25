# Thousand-Mile-Market (천리마켓)

Spring Boot 3.5 + Firebase Firestore + Redis 기반 중고거래 플랫폼

---

## 🚀 로컬 개발 환경 세팅 (팀원 공통)

### 1. 레포 클론 / 풀
```bash
git clone https://github.com/kdu-TMM/Thousand-Mile-Market.git
# 또는 기존 클론이라면
git pull origin main
```

### 2. Docker로 Redis 실행
Docker Desktop이 켜져 있어야 합니다.
```bash
# 프로젝트 루트(docker-compose.yml 있는 위치)에서
docker-compose up -d
```
> Redis가 `localhost:6379`에 뜹니다.  
> 확인: `docker ps` → `tmm-redis` 컨테이너가 보이면 OK

### 3. Firebase 서비스 계정 키 배치 ⚠️ 필수
Firebase 서비스 계정 키는 **보안상 Git에 포함되지 않습니다.**  
팀장에게 `firebase-service-account.json` 파일을 받아서 아래 경로에 배치하세요:

```
TMM/src/main/resources/firebase-service-account.json
```

> 이 파일은 `.gitignore`에 등록되어 있으므로 실수로 커밋되지 않습니다.

### 4. 서버 실행
```bash
cd TMM
./gradlew bootRun
```
서버: [http://localhost:9090](http://localhost:9090)

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

---

## 📂 Firebase 서비스 계정 키 공유 방법 (팀장 → 팀원)
카카오톡/디스코드 DM 등 **비공개 채널**로 전달하세요.  
절대 GitHub 이슈, PR 댓글, 공개 채팅에 올리지 마세요.
