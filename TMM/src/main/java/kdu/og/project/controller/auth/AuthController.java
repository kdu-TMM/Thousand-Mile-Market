package kdu.og.project.controller.auth;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Firebase 클라이언트 인증 → Spring 서버 세션 동기화
 * 클라이언트가 Firebase 로그인 후 UID/닉네임을 이 엔드포인트로 전송,
 * 서버 세션에 저장하여 WebSocket/REST API 인증에 활용.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/session")
    public ResponseEntity<Void> createSession(@RequestBody SessionRequest request,
                                              HttpSession session) {
        if (request.uid() == null || request.uid().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        session.setAttribute("uid",      request.uid());
        session.setAttribute("nickname", request.nickname() != null ? request.nickname() : "사용자");
        log.info("세션 생성 - uid: {}, nickname: {}", request.uid(), request.nickname());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/session")
    public ResponseEntity<Void> deleteSession(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok().build();
    }

    record SessionRequest(String uid, String nickname) {}
}
