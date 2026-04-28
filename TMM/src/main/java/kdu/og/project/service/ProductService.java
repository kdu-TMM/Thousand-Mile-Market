package kdu.og.project.service;

import kdu.og.project.domain.Product;
import kdu.og.project.dto.ProductDto;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Firebase Firestore 연동 예정.
 * 현재는 정적 JSON(products.json)을 프론트에서 직접 fetch하는 방식으로 동작.
 * Firebase Admin SDK 추가 후 이 서비스에 Firestore 읽기/쓰기 로직을 구현한다.
 */
@Service
public class ProductService {

    public List<Product> findAll() {
        return List.of();
    }

    public Product findById(String id) {
        return null;
    }

    public List<Product> findByCategory(String category) {
        return List.of();
    }

    public List<Product> findBySellerId(String sellerId) {
        return List.of();
    }

    public Product save(ProductDto.Request request, String sellerId) {
        return null;
    }

    public void updateStatus(String id, String status) {
    }

    public void delete(String id) {
    }
}
