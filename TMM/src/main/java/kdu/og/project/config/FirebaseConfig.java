package kdu.og.project.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Slf4j
@Configuration
public class FirebaseConfig {

    /**
     * 서비스 계정 키 경로 지정 방법 (우선순위 순):
     *  1. application.properties: firebase.credentials.path=C:/path/to/key.json
     *  2. classpath: src/main/resources/firebase-service-account.json
     *  3. 환경변수: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
     */
    @Value("${firebase.credentials.path:}")
    private String credentialsPath;

    @Bean
    public Firestore firestore() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirestoreClient.getFirestore();
        }

        GoogleCredentials credentials = resolveCredentials();

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId("thousand-mile-market")
                .build();

        FirebaseApp.initializeApp(options);
        log.info("Firebase Admin SDK 초기화 완료 (project: thousand-mile-market)");
        return FirestoreClient.getFirestore();
    }

    private GoogleCredentials resolveCredentials() throws IOException {
        // 1. properties에서 경로 명시
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            log.info("Firebase 키 로드: {}", credentialsPath);
            try (InputStream is = new FileInputStream(credentialsPath)) {
                return GoogleCredentials.fromStream(is)
                        .createScoped("https://www.googleapis.com/auth/cloud-platform");
            }
        }

        // 2. classpath 기본 위치
        InputStream is = getClass().getResourceAsStream("/firebase-service-account.json");
        if (is != null) {
            log.info("Firebase 키 로드: classpath:/firebase-service-account.json");
            return GoogleCredentials.fromStream(is)
                    .createScoped("https://www.googleapis.com/auth/cloud-platform");
        }

        // 3. GOOGLE_APPLICATION_CREDENTIALS 환경변수
        log.info("Firebase Application Default Credentials 사용 (GOOGLE_APPLICATION_CREDENTIALS)");
        return GoogleCredentials.getApplicationDefault()
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
    }
}
