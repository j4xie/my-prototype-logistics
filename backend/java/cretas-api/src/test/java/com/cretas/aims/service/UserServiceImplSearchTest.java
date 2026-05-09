package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.User;
import com.cretas.aims.mapper.UserMapper;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * T5: UserServiceImpl.searchUsers role-filter + empty-keyword tests.
 * Test execution deferred to T6 deploy (mvn unavailable on Windows CI).
 * Strategy B: in-memory role filter after repository query.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceImplSearchTest {

    @Mock UserRepository userRepository;
    @Mock UserMapper userMapper;
    @Mock PasswordEncoder passwordEncoder;
    @Mock com.cretas.aims.repository.FactoryRepository factoryRepository;
    @Mock com.cretas.aims.utils.ExcelUtil excelUtil;

    @InjectMocks UserServiceImpl userService;

    private User salesperson;
    private User warehouseManager;
    private UserDTO salespersonDto;
    private UserDTO warehouseManagerDto;
    private PageRequest pageRequest;

    @BeforeEach
    void setUp() {
        salesperson = new User();
        salesperson.setRoleCode("salesperson");
        salesperson.setFullName("张三");
        salesperson.setUsername("zhangsan");

        warehouseManager = new User();
        warehouseManager.setRoleCode("warehouse_manager");
        warehouseManager.setFullName("李四");
        warehouseManager.setUsername("lisi");

        salespersonDto = new UserDTO();
        warehouseManagerDto = new UserDTO();

        pageRequest = PageRequest.of(1, 50);

        // lenient() — different tests exercise different role filters, so not
        // every test consumes both stubs. Strict mode would flag the unused one.
        lenient().when(userMapper.toDTO(salesperson)).thenReturn(salespersonDto);
        lenient().when(userMapper.toDTO(warehouseManager)).thenReturn(warehouseManagerDto);
    }

    @Test
    @DisplayName("空 keyword 应返回工厂所有用户（不过滤）")
    void searchUsers_emptyKeyword_returnsAll() {
        when(userRepository.searchUsers(eq("F001"), eq(""), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(salesperson, warehouseManager)));

        PageResponse<UserDTO> result = userService.searchUsers("F001", "", null, pageRequest);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getTotalElements()).isEqualTo(2L);
    }

    @Test
    @DisplayName("role=salesperson 只返回业务员用户")
    void searchUsers_withRoleFilter_returnsOnlyMatchingRole() {
        when(userRepository.searchUsers(eq("F001"), eq(""), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(salesperson, warehouseManager)));

        PageResponse<UserDTO> result = userService.searchUsers("F001", "", "salesperson", pageRequest);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0)).isSameAs(salespersonDto);
    }

    @Test
    @DisplayName("role 不匹配时返回空列表")
    void searchUsers_roleFilterNoMatch_returnsEmpty() {
        when(userRepository.searchUsers(eq("F001"), eq(""), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(salesperson, warehouseManager)));

        PageResponse<UserDTO> result = userService.searchUsers("F001", "", "finance_manager", pageRequest);

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isEqualTo(0L);
    }

    @Test
    @DisplayName("role=null（不传）时不过滤，与旧接口行为一致")
    void searchUsers_nullRole_returnsAll() {
        when(userRepository.searchUsers(eq("F001"), eq("张"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(salesperson)));

        PageResponse<UserDTO> result = userService.searchUsers("F001", "张", null, pageRequest);

        assertThat(result.getContent()).hasSize(1);
    }
}
