package kdu.og.project.controller;

import jakarta.servlet.http.HttpSession;
import kdu.og.project.dto.*;
import kdu.og.project.service.AuctionBidFacade;
import kdu.og.project.service.AuctionService;
import kdu.og.project.service.AuctionSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 경매 REST API
 * 인증: Firebase UID를 HttpSession("uid")에서 읽음
 */
@Slf4j
@RestController
@RequestMapping("/api/auction")
@RequiredArgsConstructor
public class AuctionController {

    private final AuctionService    auctionService;
    private final AuctionSseService auctionSseService;
    private final AuctionBidFacade  auctionBidFacade;

    /** 진행 중인 경매 조회 */
    @GetMapping("/active")
    public ResponseEntity<OngoingAuctionResponse> getOngoingAuction() {
        return ResponseEntity.ok(auctionService.getOngoingAuctionWithItem());
    }

    /** 예정 경매 목록 조회 */
    @GetMapping("/scheduled")
    public ResponseEntity<List<ScheduledAuctionResponse>> getScheduledAuctions() {
        return ResponseEntity.ok(auctionService.scheduledAuctionWithItem());
    }

    /** 입찰 (Redis Lua 스크립트 + Firestore 트랜잭션) */
    @PostMapping("/{auctionId}/bid")
    public ResponseEntity<?> placeBid(
            @PathVariable String     auctionId,
            @RequestBody  AuctionRequest request,
            HttpSession session) {

        String uid      = (String) session.getAttribute("uid");
        String nickname = (String) session.getAttribute("nickname");

        if (uid == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("로그인이 필요합니다");
        }

        boolean success = auctionBidFacade.bid(
                auctionId, uid, nickname, request.getBidAmount(), LocalDateTime.now());

        if (!success) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("입찰 실패! 현재가보다 높은 금액을 입력해 주세요");
        }

        return ResponseEntity.ok("입찰 성공!");
    }

    /** 진행 중 경매 상위 5개 입찰 내역 */
    @GetMapping("/active/history")
    public ResponseEntity<List<AuctionBidResponse>> getBidHistory() {
        return ResponseEntity.ok(auctionService.getAuctionStatus());
    }

    /** SSE 구독 (실시간 입찰 업데이트) */
    @GetMapping(value = "/stream/{auctionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> streamAuction(@PathVariable String auctionId) {
        return ResponseEntity.ok(auctionSseService.subscribe(auctionId));
    }

    /** 이번 달 낙찰 내역 */
    @GetMapping("/winners/monthly")
    public ResponseEntity<List<AuctionResponse>> getMonthlyWinners() {
        return ResponseEntity.ok(auctionService.getMonthlyWinners());
    }

    /** [데모] 정규 시간 즉시 종료 → 이연시간 진입 가능 상태로 */
    @GetMapping("/test/regular-end/{auctionId}")
    public ResponseEntity<String> expireRegularTime(@PathVariable String auctionId) {
        auctionService.expireRegularTime(auctionId);
        return ResponseEntity.ok(
                "경매(" + auctionId + ")의 정규 시간이 종료되었습니다! 이제 입찰하면 이연시간이 시작됩니다.");
    }
}
