package kdu.og.project.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomCreateRequest {

    private String targetUid;
    private String targetNickname;
    private String productId;
    private String productName;
}
