// 完整正确的createBatch函数
// 复制此代码替换 processingController.js 中的 createBatch 函数

export const createBatch = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      productType,
      rawMaterials,
      startDate,
      productionLine,
      supervisorId,
      supervisorName,
      targetQuantity,
      notes
    } = req.body;

    // 生成批次编号 - 如果没有产品类型，使用原料类型
    const batchType = productType || rawMaterials?.[0]?.materialType || '待定';
    const batchNumber = await generateBatchNumber(factoryId, batchType);

    const batch = await prisma.processingBatch.create({
      data: {
        batchNumber,
        productType: productType || null,
        rawMaterials,
        startDate: startDate ? new Date(startDate) : new Date(),
        productionLine,
        targetQuantity: targetQuantity ? parseFloat(targetQuantity) : null,
        notes,
        status: 'planning',
        factory: { connect: { id: factoryId } },
        ...(supervisorId && { supervisor: { connect: { id: supervisorId } } })
      },
      include: {
        supervisor: supervisorId ? {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        } : undefined
      }
    });

    res.status(201).json(createSuccessResponse(batch, '批次创建成功'));
  } catch (error) {
    next(error);
  }
};
