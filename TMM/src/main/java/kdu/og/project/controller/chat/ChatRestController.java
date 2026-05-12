package kdu.og.project.controller.chat;

import jakarta.servlet.http.HttpSession;
import kdu.og.project.domain.chat.ChatRoom;
import kdu.og.project.dto.chat.ChatMessageResponse;
import kdu.og.project.dto.chat.ChatRoomCreateRequest;
import kdu.og.project.dto.chat.ChatRoomResponse;
import kdu.og.project.service.chat.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatRestController {

    private final ChatService chatService;

    /** 내 채팅방 목록 */
    @GetMapping("/rooms")
    public ResponseEntity<List<ChatRoomResponse>> getRooms(HttpSession session) {
        String uid = (String) session.getAttribute("uid");
        if (uid == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(chatService.getRooms(uid));
    }

    /** 채팅방 생성 or 기존 방 반환 */
    @PostMapping("/rooms")
    public ResponseEntity<ChatRoomResponse> getOrCreate(@RequestBody ChatRoomCreateRequest request,
                                                        HttpSession session) {
        String myUid      = (String) session.getAttribute("uid");
        String myNickname = (String) session.getAttribute("nickname");
        if (myUid == null) return ResponseEntity.status(401).build();

        ChatRoom room = chatService.getOrCreateRoom(
                myUid, myNickname,
                request.getTargetUid(), request.getTargetNickname(),
                request.getProductId(), request.getProductName());

        return ResponseEntity.ok(ChatRoomResponse.from(room, myUid, 0));
    }

    /** 메시지 내역 조회 + 읽음 처리 */
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getHistory(@PathVariable Long roomId,
                                                                HttpSession session) {
        String uid = (String) session.getAttribute("uid");
        if (uid == null) return ResponseEntity.status(401).build();
        chatService.markAsRead(roomId, uid);
        return ResponseEntity.ok(chatService.getHistory(roomId));
    }
}
