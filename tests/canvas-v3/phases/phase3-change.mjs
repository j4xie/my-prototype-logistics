// tests/canvas-v3/phases/phase3-change.mjs

export async function phase3Change(state, api, report) {
  console.log('\n=== Phase 3: Requirement Change ===');

  // 3.1 Add attachment field
  console.log('3.1 Adding contract_attachment field...');
  try {
    const attachResp = await api.authedPost(state.factoryId, '/config/v2/dynamic-fields', {
      moduleCode: 'sales_order',
      fieldCode: 'contract_attachment',
      fieldType: 'ATTACHMENT',
      label: '合同附件',
      config: {
        accept: '.pdf,.doc,.docx',
        maxSize: 10485760,
        maxCount: 3,
      },
    });
    const success = attachResp.id || attachResp.data?.id;
    report.addCheckpoint('P3-1', '添加附件字段 contract_attachment', success ? 'PASS' : 'FAIL', {
      response: attachResp,
    });
    console.log(`  ${success ? '✅' : '❌'} Attachment field created`);
  } catch (e) {
    report.addCheckpoint('P3-1', '添加附件字段', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 3.2 Modify validation rule threshold 100 → 500 (both CREATE and UPDATE rules)
  console.log('3.2 Modifying validation rule 100→500...');
  try {
    const updateRuleResp = await api.authedPut(
      state.factoryId,
      '/config/v2/validation-rules/so_amount_min',
      {
        moduleCode: 'sales_order',
        operation: 'CREATE',
        condition: '#totalAmount < 500',
        errorMessage: '订单金额不能低于500元',
        severity: 'BLOCK',
        enabled: true,
        sortOrder: 1,
      }
    );
    const success = updateRuleResp.id || updateRuleResp.data?.id;
    report.addCheckpoint('P3-2', '修改校验阈值 100→500 (CREATE)', success ? 'PASS' : 'FAIL', {
      response: updateRuleResp,
    });
    console.log(`  ${success ? '✅' : '❌'} Validation rule updated (CREATE)`);

    // Also update the UPDATE rule so both operations stay in sync
    const updateRuleRespU = await api.authedPut(
      state.factoryId,
      '/config/v2/validation-rules/so_amount_min_update',
      {
        moduleCode: 'sales_order',
        operation: 'UPDATE',
        condition: '#totalAmount < 500',
        errorMessage: '订单编辑: 金额不能低于500元',
        severity: 'BLOCK',
        enabled: true,
        sortOrder: 1,
      }
    );
    const successU = updateRuleRespU.id || updateRuleRespU.data?.id;
    report.addCheckpoint('P3-2b', '修改 UPDATE 校验阈值 100→500', successU ? 'PASS' : 'FAIL');
  } catch (e) {
    report.addCheckpoint('P3-2', '修改校验阈值', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 3.3 Add BOM change_records sub-table
  console.log('3.3 Adding BOM change_records sub-table...');
  try {
    const bomResp = await api.authedPost(state.factoryId, '/config/v2/dynamic-fields', {
      moduleCode: 'bom',
      fieldCode: 'change_records',
      fieldType: 'SUB_TABLE',
      label: '变更记录',
      config: {
        columns: [
          { code: 'change_date', label: '变更日期', type: 'DATE' },
          { code: 'change_type', label: '变更类型', type: 'TEXT' },
          { code: 'description', label: '说明', type: 'TEXT' },
          { code: 'operator', label: '操作人', type: 'TEXT' },
        ],
      },
    });
    const success = bomResp.id || bomResp.data?.id;
    report.addCheckpoint('P3-3', '添加 BOM 子表 change_records', success ? 'PASS' : 'FAIL', {
      response: bomResp,
    });
    console.log(`  ${success ? '✅' : '❌'} BOM sub-table created`);
  } catch (e) {
    report.addCheckpoint('P3-3', '添加 BOM 子表', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 3.4 Change-set workflow → publish → verify DDL
  console.log('3.4 Publishing via change-set workflow...');

  // First ensure there's a draft (modify any module to create one)
  try {
    await api.authedPut(state.factoryId, '/config/modules/sales_order', {
      enabled: true,
      changeSummary: 'Phase 3 change trigger',
    });
  } catch (e) {
    console.log(`  ⚠️ Could not update config to create draft: ${e.message}`);
  }

  try {
    // Create change set
    const csResp = await api.authedPost(state.factoryId, '/config-changes', {
      configType: 'OTHER',
      configId: 'canvas-v3-change',
      configName: 'Canvas V3 需求变更',
      afterSnapshot: '{"added":2,"modified":1}',
    });
    const csId = csResp.id || csResp.data?.id;
    report.addCheckpoint('P3-4a', '创建变更集', csId ? 'PASS' : 'FAIL', {
      changeSetId: csId,
      response: csResp,
    });
    console.log(`  ${csId ? '✅' : '❌'} Change set: ${csId}`);

    if (csId) {
      const apprResp = await api.authedPost(
        state.factoryId,
        `/config-changes/${csId}/approve`,
        { comment: '变更审批' }
      );
      const apprSuccess = apprResp.success || apprResp.id || apprResp.status === 'APPROVED';
      report.addCheckpoint('P3-4b', '审批变更集', apprSuccess ? 'PASS' : 'FAIL');

      const applyResp = await api.authedPost(
        state.factoryId,
        `/config-changes/${csId}/apply`,
        {}
      );
      const applySuccess = applyResp.success || applyResp.id || applyResp.status === 'APPLIED';
      report.addCheckpoint('P3-4c', '应用变更集', applySuccess ? 'PASS' : 'FAIL');
    }

    // Publish (triggers DDL execution)
    console.log('  Publishing config (triggers DDL)...');
    const pubResp = await api.authedPost(
      state.factoryId,
      '/config/publish?summary=V3+add+attachment+modify+rules',
      {}
    );
    const pubSuccess = pubResp.success !== false;
    report.addCheckpoint('P3-4d', '发布配置 (触发二次 DDL)', pubSuccess ? 'PASS' : 'FAIL', {
      response: pubResp,
    });
    console.log(`  ${pubSuccess ? '✅' : '❌'} Published`);

    await new Promise(r => setTimeout(r, 2000));

    // Verify new DDL executed
    const ddlLog = await api.authedGet(state.factoryId, '/config/v2/ddl-log');
    const ddlItems = Array.isArray(ddlLog) ? ddlLog : ddlLog.data || [];
    const executedCount = ddlItems.filter(d => d.status === 'EXECUTED').length;
    report.addCheckpoint(
      'P3-4e',
      `DDL 总计 ${executedCount} (期望 ≥6: 4 初始 + 2 新增)`,
      executedCount >= 6 ? 'PASS' : 'FAIL',
      { executedCount, total: ddlItems.length }
    );
    console.log(`  DDL total: ${executedCount} executed`);

    // Verify all dynamic fields ACTIVE (should be 5 sales_order + 1 bom = 6)
    const allList = await api.authedGet(state.factoryId, '/config/v2/dynamic-fields');
    const allItems = Array.isArray(allList) ? allList : allList.data || [];
    const activeCount = allItems.filter(f => f.status === 'ACTIVE').length;
    report.addCheckpoint(
      'P3-4f',
      `${activeCount} 字段变 ACTIVE (期望 ≥6)`,
      activeCount >= 6 ? 'PASS' : 'FAIL',
      { activeCount, total: allItems.length }
    );
    console.log(`  Dynamic fields: ${activeCount} ACTIVE`);
  } catch (e) {
    console.error('Phase 3.4 error:', e.message);
    report.addCheckpoint('P3-4', '发布流程', 'FAIL', { error: e.message });
  }
}
