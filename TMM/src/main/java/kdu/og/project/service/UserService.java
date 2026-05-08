package kdu.og.project.service;

import kdu.og.project.domain.User;
import kdu.og.project.dto.UserDto;
import org.springframework.stereotype.Service;

/**
 * Firebase Authentication + Firestore 연동 예정.
 * 회원가입: Firebase Auth createUser → Firestore users 컬렉션에 프로필 저장.
 * 로그인: Firebase Auth signInWithEmailAndPassword (프론트 JS SDK에서 처리).
 */
@Service
public class UserService {

    public User register(UserDto.RegisterRequest request) {
        return null;
    }

    public User findByUid(String uid) {
        return null;
    }

    public User findByPhone(String phone) {
        return null;
    }

    public User updateRegion(String uid, String region) {
        return null;
    }
}
