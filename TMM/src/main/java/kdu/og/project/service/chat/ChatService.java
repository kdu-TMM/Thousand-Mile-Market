package kdu.og.project.service.chat;

import kdu.og.project.domain.chat.ChatMessage;
import kdu.og.project.domain.chat.ChatRoom;
import kdu.og.project.dto.chat.ChatMessageResponse;
import kdu.og.project.dto.chat.ChatRoomResponse;
import kdu.og.project.repository.chat.ChatMessageRepository;
import kdu.og.project.repository.chat.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;

    @Transactional
    public ChatRoom getOrCreateRoom(String myUid, String myNickname,
                                    String targetUid, String targetNickname,
                                    String productId, String productName) {
        String key = ChatRoom.generateRoomKey(myUid, targetUid, productId);
        return chatRoomRepository.findByRoomKey(key).orElseGet(() ->
                chatRoomRepository.save(ChatRoom.builder()
                        .roomKey(key)
                        .user1Uid(myUid)
                        .user1Nickname(myNickname)
                        .user2Uid(targetUid)
                        .user2Nickname(targetNickname)
                        .productId(productId)
                        .productName(productName)
                        .build()));
    }

    @Transactional(readOnly = true)
    public List<ChatRoomResponse> getRooms(String uid) {
        return chatRoomRepository
                .findByUser1UidOrUser2UidOrderByLastMessageAtDesc(uid, uid)
                .stream()
                .map(room -> {
                    long unread = chatMessageRepository
                            .countByRoomAndIsReadFalseAndSenderUidNot(room, uid);
                    return ChatRoomResponse.from(room, uid, unread);
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatMessage saveMessage(Long roomId, String senderUid,
                                   String senderNickname, String content) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + roomId));

        ChatMessage message = chatMessageRepository.save(ChatMessage.builder()
                .room(room)
                .senderUid(senderUid)
                .senderNickname(senderNickname)
                .content(content)
                .build());

        room.updateLastMessage(content, message.getSentAt());
        return message;
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getHistory(Long roomId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + roomId));
        return chatMessageRepository.findByRoomOrderBySentAtAsc(room)
                .stream()
                .map(ChatMessageResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markAsRead(Long roomId, String readerUid) {
        chatRoomRepository.findById(roomId).ifPresent(room ->
                chatMessageRepository.markAllAsRead(room, readerUid));
    }
}
