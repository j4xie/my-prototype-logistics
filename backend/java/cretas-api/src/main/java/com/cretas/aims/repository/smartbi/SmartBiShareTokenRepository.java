package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiShareToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface SmartBiShareTokenRepository extends JpaRepository<SmartBiShareToken, Long> {

    Optional<SmartBiShareToken> findByToken(String token);

    @Modifying
    @Query("DELETE FROM SmartBiShareToken t WHERE t.expiresAt < :now")
    int deleteExpiredTokens(LocalDateTime now);
}
