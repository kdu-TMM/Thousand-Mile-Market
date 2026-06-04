package kdu.og.project.controller;

import kdu.og.project.service.SmsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sms")
@RequiredArgsConstructor
public class SmsController {

    private final SmsService smsService;

    /** POST /api/sms/send  body: { "phone": "01012345678" } */
    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> send(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        if (phone == null || !phone.matches("^01[0-9]{8,9}$")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "올바르지 않은 전화번호입니다."));
        }
        try {
            smsService.sendVerificationCode(phone);
            return ResponseEntity.ok(Map.of("success", true, "message", "인증번호가 발송되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "SMS 발송에 실패했습니다: " + e.getMessage()));
        }
    }

    /** POST /api/sms/verify  body: { "phone": "01012345678", "code": "123456" } */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String code  = body.get("code");
        if (phone == null || code == null || code.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "verified", false, "message", "전화번호와 인증번호를 입력해주세요."));
        }
        boolean ok = smsService.verifyCode(phone, code);
        if (ok) {
            return ResponseEntity.ok(Map.of("success", true, "verified", true, "message", "인증이 완료되었습니다."));
        }
        return ResponseEntity.badRequest()
                .body(Map.of("success", false, "verified", false, "message", "인증번호가 올바르지 않거나 만료되었습니다."));
    }
}
