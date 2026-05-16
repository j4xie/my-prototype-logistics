package com.cretas.aims.service.bom.impl;

import com.cretas.aims.entity.bom.BomRecipe;
import com.cretas.aims.entity.bom.BomVersion;
import com.cretas.aims.entity.bom.BomVersion.VersionStatus;
import com.cretas.aims.repository.bom.BomRecipeRepository;
import com.cretas.aims.repository.bom.BomVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * BomVersionServiceImpl approve() unit test — Issue #724.
 *
 * <p>Verifies that {@code approve()} explicitly OBSOLETEs the prior currently-effective
 * APPROVED version (with flush) BEFORE writing the new APPROVED row, to avoid the partial
 * unique index {@code uq_bv_one_current_per_recipe} violation that surfaces because the
 * AFTER trigger {@code trg_bom_version_supersede} fires too late.
 *
 * @author Cretas Team
 * @since 2026-05-16
 */
@DisplayName("BomVersionServiceImpl.approve() — Issue #724 supersede regression")
@ExtendWith(MockitoExtension.class)
class BomVersionServiceImplApproveTest {

    private static final String FACTORY = "F006";
    private static final String RECIPE_ID = "21d65c99-959c-4195-ad8c-34825b4288c9";
    private static final String PRIOR_ID = "prior-approved-uuid";
    private static final String NEW_ID = "new-pending-uuid";
    private static final Long APPROVER = 999L;

    @Mock
    private BomVersionRepository versionRepo;

    @Mock
    private BomRecipeRepository recipeRepo;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private BomVersionServiceImpl service;

    private BomVersion newPendingVersion;
    private BomVersion priorApprovedVersion;
    private BomRecipe recipe;

    @BeforeEach
    void setUp() {
        // The PENDING_APPROVAL row that the user wants to promote to APPROVED
        newPendingVersion = BomVersion.builder()
                .id(NEW_ID)
                .factoryId(FACTORY)
                .bomRecipeId(RECIPE_ID)
                .versionNumber(2)
                .status(VersionStatus.PENDING_APPROVAL)
                .build();

        // The CURRENT APPROVED row that must be OBSOLETEd before #724 fix
        priorApprovedVersion = BomVersion.builder()
                .id(PRIOR_ID)
                .factoryId(FACTORY)
                .bomRecipeId(RECIPE_ID)
                .versionNumber(1)
                .status(VersionStatus.APPROVED)
                .effectiveFrom(LocalDate.now().minusDays(30))
                .effectiveTo(null)   // currently effective — null = unbounded
                .approvedBy(100L)
                .build();

        recipe = BomRecipe.builder()
                .id(RECIPE_ID)
                .factoryId(FACTORY)
                .build();
    }

    @Test
    @DisplayName("#724 — approve() of new version supersedes prior APPROVED in same transaction (PRIMARY REGRESSION)")
    void approve_secondVersion_supersedesPriorApproved() {
        // arrange — getById finds the PENDING row, findCurrentInStatus finds the prior APPROVED
        when(versionRepo.findById(NEW_ID)).thenReturn(Optional.of(newPendingVersion));
        when(versionRepo.findCurrentInStatus(FACTORY, RECIPE_ID, VersionStatus.APPROVED))
                .thenReturn(Optional.of(priorApprovedVersion));
        when(versionRepo.save(any(BomVersion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(recipeRepo.findById(RECIPE_ID)).thenReturn(Optional.of(recipe));

        // act
        BomVersion approved = service.approve(FACTORY, NEW_ID, APPROVER);

        // assert — new version is APPROVED with today as effective_from
        assertEquals(VersionStatus.APPROVED, approved.getStatus(), "new version should be APPROVED");
        assertEquals(LocalDate.now(), approved.getEffectiveFrom(), "effective_from = today");
        assertNull(approved.getEffectiveTo(), "effective_to = null (currently effective)");
        assertEquals(APPROVER, approved.getApprovedBy());

        // assert — prior version was OBSOLETEd with effective_to = today - 1
        assertEquals(VersionStatus.OBSOLETE, priorApprovedVersion.getStatus(),
                "prior APPROVED must transition to OBSOLETE");
        assertEquals(LocalDate.now().minusDays(1), priorApprovedVersion.getEffectiveTo(),
                "prior effective_to = today - 1 (per service contract + trigger parity)");

        // assert — ordering: prior was saved + FLUSHED before new row save (critical for #724)
        ArgumentCaptor<BomVersion> savedCaptor = ArgumentCaptor.forClass(BomVersion.class);
        verify(versionRepo, times(2)).save(savedCaptor.capture());
        List<BomVersion> saved = savedCaptor.getAllValues();
        assertEquals(PRIOR_ID, saved.get(0).getId(), "FIRST save must be prior (OBSOLETE)");
        assertEquals(NEW_ID,   saved.get(1).getId(), "SECOND save must be new (APPROVED)");

        // assert — flush was called between the two saves (required to make supersede visible
        // to the partial unique index before the new APPROVED row is written)
        verify(versionRepo, times(1)).flush();

        // assert — BomRecipe.isCurrent sync still runs
        assertTrue(recipe.getIsCurrent(), "BomRecipe.isCurrent should be true after approve");
        assertEquals(2, recipe.getVersion(), "BomRecipe.version should match approved.versionNumber");
    }

    @Test
    @DisplayName("#724 — approve() of FIRST version (no prior APPROVED) skips supersede cleanly")
    void approve_firstVersion_noPriorToSupersede() {
        // arrange — no prior APPROVED exists
        when(versionRepo.findById(NEW_ID)).thenReturn(Optional.of(newPendingVersion));
        when(versionRepo.findCurrentInStatus(FACTORY, RECIPE_ID, VersionStatus.APPROVED))
                .thenReturn(Optional.empty());
        when(versionRepo.save(any(BomVersion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(recipeRepo.findById(RECIPE_ID)).thenReturn(Optional.of(recipe));

        // act
        BomVersion approved = service.approve(FACTORY, NEW_ID, APPROVER);

        // assert — new version APPROVED, no flush needed (no prior to supersede)
        assertEquals(VersionStatus.APPROVED, approved.getStatus());
        verify(versionRepo, never()).flush();
        verify(versionRepo, times(1)).save(any(BomVersion.class));   // only new row
    }

    @Test
    @DisplayName("#724 — approve() of same row that's already 'current' does NOT self-supersede")
    void approve_sameRowAsPriorCurrent_doesNotSelfSupersede() {
        // Edge case: idempotent re-approve of the already-current row (defensive).
        // findCurrentInStatus returns the SAME row being approved → must skip supersede.
        BomVersion alreadyApproved = BomVersion.builder()
                .id(NEW_ID)
                .factoryId(FACTORY)
                .bomRecipeId(RECIPE_ID)
                .versionNumber(1)
                .status(VersionStatus.DRAFT)   // allow re-approve from DRAFT fast path
                .build();
        when(versionRepo.findById(NEW_ID)).thenReturn(Optional.of(alreadyApproved));
        when(versionRepo.findCurrentInStatus(FACTORY, RECIPE_ID, VersionStatus.APPROVED))
                .thenReturn(Optional.of(alreadyApproved));   // same id
        when(versionRepo.save(any(BomVersion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(recipeRepo.findById(RECIPE_ID)).thenReturn(Optional.of(recipe));

        // act
        BomVersion approved = service.approve(FACTORY, NEW_ID, APPROVER);

        // assert — no self-supersede (would orphan the row as OBSOLETE)
        assertEquals(VersionStatus.APPROVED, approved.getStatus());
        verify(versionRepo, never()).flush();
        verify(versionRepo, times(1)).save(any(BomVersion.class));   // only the new approve save
    }

    @Test
    @DisplayName("approve() rejects from terminal status (OBSOLETE / REJECTED / APPROVED)")
    void approve_fromTerminalStatus_throws() {
        BomVersion obsolete = BomVersion.builder()
                .id(NEW_ID).factoryId(FACTORY).bomRecipeId(RECIPE_ID).versionNumber(1)
                .status(VersionStatus.OBSOLETE).build();
        when(versionRepo.findById(NEW_ID)).thenReturn(Optional.of(obsolete));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.approve(FACTORY, NEW_ID, APPROVER));
        assertTrue(ex.getMessage().contains("OBSOLETE"));
        verify(versionRepo, never()).save(any(BomVersion.class));
        verify(versionRepo, never()).flush();
    }
}
