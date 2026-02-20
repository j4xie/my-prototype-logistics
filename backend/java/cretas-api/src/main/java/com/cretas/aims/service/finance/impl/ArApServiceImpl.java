package com.cretas.aims.service.finance.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.enums.ArApTransactionType;
import com.cretas.aims.entity.enums.CounterpartyType;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.finance.ArApTransaction;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.repository.finance.ArApTransactionRepository;
import com.cretas.aims.service.finance.ArApService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class ArApServiceImpl implements ArApService {

    private static final Logger log = LoggerFactory.getLogger(ArApServiceImpl.class);

    private final ArApTransactionRepository transactionRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;

    public ArApServiceImpl(ArApTransactionRepository transactionRepository,
                           CustomerRepository customerRepository,
                           SupplierRepository supplierRepository) {
        this.transactionRepository = transactionRepository;
        this.customerRepository = customerRepository;
        this.supplierRepository = supplierRepository;
    }

    // ==================== 挂账 ====================

    @Override
    @Transactional
    public ArApTransaction recordReceivable(String factoryId, String customerId,
                                             String salesOrderId, BigDecimal amount,
                                             LocalDate dueDate, Long operatedBy, String remark) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("应收金额必须大于0");
        }

        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));

        // 检查是否已挂账
        if (salesOrderId != null && transactionRepository.existsByFactoryIdAndSalesOrderIdAndTransactionType(
                factoryId, salesOrderId, ArApTransactionType.AR_INVOICE)) {
            throw new BusinessException("该销售订单已生成应收记录");
        }

        // 更新客户余额
        BigDecimal newBalance = (customer.getCurrentBalance() != null ? customer.getCurrentBalance() : BigDecimal.ZERO)
                .add(amount);
        customer.setCurrentBalance(newBalance);
        customerRepository.save(customer);

        // 创建交易记录
        ArApTransaction transaction = buildTransaction(
                factoryId, ArApTransactionType.AR_INVOICE,
                CounterpartyType.CUSTOMER, customerId, customer.getName(),
                amount, newBalance, dueDate, operatedBy, remark);
        transaction.setSalesOrderId(salesOrderId);

        log.info("应收挂账: factoryId={}, customerId={}, amount={}, balance={}",
                factoryId, customerId, amount, newBalance);
        return transactionRepository.save(transaction);
    }

    @Override
    @Transactional
    public ArApTransaction recordPayable(String factoryId, String supplierId,
                                          String purchaseOrderId, BigDecimal amount,
                                          LocalDate dueDate, Long operatedBy, String remark) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("应付金额必须大于0");
        }

        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));

        if (purchaseOrderId != null && transactionRepository.existsByFactoryIdAndPurchaseOrderIdAndTransactionType(
                factoryId, purchaseOrderId, ArApTransactionType.AP_INVOICE)) {
            throw new BusinessException("该采购订单已生成应付记录");
        }

        BigDecimal newBalance = (supplier.getCurrentBalance() != null ? supplier.getCurrentBalance() : BigDecimal.ZERO)
                .add(amount);
        supplier.setCurrentBalance(newBalance);
        supplierRepository.save(supplier);

        ArApTransaction transaction = buildTransaction(
                factoryId, ArApTransactionType.AP_INVOICE,
                CounterpartyType.SUPPLIER, supplierId, supplier.getName(),
                amount, newBalance, dueDate, operatedBy, remark);
        transaction.setPurchaseOrderId(purchaseOrderId);

        log.info("应付挂账: factoryId={}, supplierId={}, amount={}, balance={}",
                factoryId, supplierId, amount, newBalance);
        return transactionRepository.save(transaction);
    }

    // ==================== 收付款 ====================

    @Override
    @Transactional
    public ArApTransaction recordArPayment(String factoryId, String customerId,
                                            BigDecimal amount, PaymentMethod method,
                                            String paymentReference, Long operatedBy, String remark) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("收款金额必须大于0");
        }

        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));

        // 付款冲减余额（amount为正数，存为负数表示减少应收）
        BigDecimal negAmount = amount.negate();
        BigDecimal newBalance = (customer.getCurrentBalance() != null ? customer.getCurrentBalance() : BigDecimal.ZERO)
                .add(negAmount);
        customer.setCurrentBalance(newBalance);
        customerRepository.save(customer);

        ArApTransaction transaction = buildTransaction(
                factoryId, ArApTransactionType.AR_PAYMENT,
                CounterpartyType.CUSTOMER, customerId, customer.getName(),
                negAmount, newBalance, null, operatedBy, remark);
        transaction.setPaymentMethod(method);
        transaction.setPaymentReference(paymentReference);

        log.info("应收收款: factoryId={}, customerId={}, amount={}, balance={}",
                factoryId, customerId, amount, newBalance);
        return transactionRepository.save(transaction);
    }

    @Override
    @Transactional
    public ArApTransaction recordApPayment(String factoryId, String supplierId,
                                            BigDecimal amount, PaymentMethod method,
                                            String paymentReference, Long operatedBy, String remark) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("付款金额必须大于0");
        }

        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));

        BigDecimal negAmount = amount.negate();
        BigDecimal newBalance = (supplier.getCurrentBalance() != null ? supplier.getCurrentBalance() : BigDecimal.ZERO)
                .add(negAmount);
        supplier.setCurrentBalance(newBalance);
        supplierRepository.save(supplier);

        ArApTransaction transaction = buildTransaction(
                factoryId, ArApTransactionType.AP_PAYMENT,
                CounterpartyType.SUPPLIER, supplierId, supplier.getName(),
                negAmount, newBalance, null, operatedBy, remark);
        transaction.setPaymentMethod(method);
        transaction.setPaymentReference(paymentReference);

        log.info("应付付款: factoryId={}, supplierId={}, amount={}, balance={}",
                factoryId, supplierId, amount, newBalance);
        return transactionRepository.save(transaction);
    }

    // ==================== 手工调整 ====================

    @Override
    @Transactional
    public ArApTransaction recordAdjustment(String factoryId, CounterpartyType counterpartyType,
                                             String counterpartyId, BigDecimal amount,
                                             Long operatedBy, String remark) {
        String counterpartyName;
        BigDecimal newBalance;

        if (counterpartyType == CounterpartyType.CUSTOMER) {
            Customer customer = customerRepository.findByIdAndFactoryId(counterpartyId, factoryId)
                    .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
            newBalance = (customer.getCurrentBalance() != null ? customer.getCurrentBalance() : BigDecimal.ZERO)
                    .add(amount);
            customer.setCurrentBalance(newBalance);
            customerRepository.save(customer);
            counterpartyName = customer.getName();
        } else {
            Supplier supplier = supplierRepository.findByIdAndFactoryId(counterpartyId, factoryId)
                    .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
            newBalance = (supplier.getCurrentBalance() != null ? supplier.getCurrentBalance() : BigDecimal.ZERO)
                    .add(amount);
            supplier.setCurrentBalance(newBalance);
            supplierRepository.save(supplier);
            counterpartyName = supplier.getName();
        }

        ArApTransactionType type = counterpartyType == CounterpartyType.CUSTOMER
                ? ArApTransactionType.AR_ADJUSTMENT : ArApTransactionType.AP_ADJUSTMENT;

        ArApTransaction transaction = buildTransaction(
                factoryId, type, counterpartyType, counterpartyId, counterpartyName,
                amount, newBalance, null, operatedBy, remark);

        log.info("手工调整: factoryId={}, type={}, counterpartyId={}, amount={}, balance={}",
                factoryId, counterpartyType, counterpartyId, amount, newBalance);
        return transactionRepository.save(transaction);
    }

    // ==================== 查询 ====================

    @Override
    public PageResponse<ArApTransaction> getTransactions(String factoryId,
                                                          CounterpartyType counterpartyType,
                                                          String counterpartyId,
                                                          int page, int size) {
        PageRequest pageRequest = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "transactionDate"));
        Page<ArApTransaction> result;

        if (counterpartyId != null) {
            result = transactionRepository.findByFactoryIdAndCounterpartyTypeAndCounterpartyIdOrderByTransactionDateDesc(
                    factoryId, counterpartyType, counterpartyId, pageRequest);
        } else if (counterpartyType != null) {
            result = transactionRepository.findByFactoryIdAndCounterpartyTypeOrderByTransactionDateDesc(
                    factoryId, counterpartyType, pageRequest);
        } else {
            result = transactionRepository.findByFactoryIdOrderByTransactionDateDesc(factoryId, pageRequest);
        }

        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public Map<String, Object> getStatement(String factoryId, CounterpartyType counterpartyType,
                                             String counterpartyId,
                                             LocalDate startDate, LocalDate endDate) {
        Map<String, Object> statement = new LinkedHashMap<>();

        // 期初余额：startDate之前最后一笔交易的balanceAfter
        List<BigDecimal> openingBalances = transactionRepository.findOpeningBalance(
                factoryId, counterpartyType, counterpartyId, startDate);
        BigDecimal openingBalance = openingBalances.isEmpty() ? BigDecimal.ZERO : openingBalances.get(0);

        // 本期交易明细
        List<ArApTransaction> transactions = transactionRepository.findByCounterpartyAndDateRange(
                factoryId, counterpartyType, counterpartyId, startDate, endDate);

        // 本期发生额（借方/贷方）
        BigDecimal periodDebit = BigDecimal.ZERO;  // 挂账增加
        BigDecimal periodCredit = BigDecimal.ZERO;  // 付款减少
        for (ArApTransaction t : transactions) {
            if (t.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                periodDebit = periodDebit.add(t.getAmount());
            } else {
                periodCredit = periodCredit.add(t.getAmount().abs());
            }
        }

        BigDecimal closingBalance = openingBalance.add(periodDebit).subtract(periodCredit);

        statement.put("counterpartyId", counterpartyId);
        statement.put("counterpartyType", counterpartyType.name());
        statement.put("startDate", startDate.toString());
        statement.put("endDate", endDate.toString());
        statement.put("openingBalance", openingBalance);
        statement.put("periodDebit", periodDebit);
        statement.put("periodCredit", periodCredit);
        statement.put("closingBalance", closingBalance);
        statement.put("transactions", transactions);
        statement.put("transactionCount", transactions.size());

        return statement;
    }

    @Override
    public List<Map<String, Object>> getAgingAnalysis(String factoryId, CounterpartyType counterpartyType) {
        // 获取所有挂账交易（未完全冲销的）
        List<ArApTransaction> invoices;
        if (counterpartyType == CounterpartyType.CUSTOMER) {
            invoices = transactionRepository.findOverdueReceivables(factoryId, LocalDate.of(9999, 12, 31));
        } else {
            invoices = transactionRepository.findOverduePayables(factoryId, LocalDate.of(9999, 12, 31));
        }

        // 按交易对手分组，计算账龄桶
        Map<String, Map<String, Object>> agingMap = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();

        for (ArApTransaction invoice : invoices) {
            String cpId = invoice.getCounterpartyId();
            agingMap.computeIfAbsent(cpId, k -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("counterpartyId", cpId);
                row.put("counterpartyName", invoice.getCounterpartyName());
                row.put("current", BigDecimal.ZERO);      // 未到期
                row.put("days1_30", BigDecimal.ZERO);
                row.put("days31_60", BigDecimal.ZERO);
                row.put("days61_90", BigDecimal.ZERO);
                row.put("days91_120", BigDecimal.ZERO);
                row.put("days120plus", BigDecimal.ZERO);
                row.put("total", BigDecimal.ZERO);
                return row;
            });

            Map<String, Object> row = agingMap.get(cpId);
            BigDecimal amt = invoice.getAmount();
            String bucket = getBucket(invoice.getDueDate(), today);
            row.put(bucket, ((BigDecimal) row.get(bucket)).add(amt));
            row.put("total", ((BigDecimal) row.get("total")).add(amt));
        }

        return new ArrayList<>(agingMap.values());
    }

    @Override
    public Map<String, Object> getFinanceOverview(String factoryId) {
        Map<String, Object> overview = new LinkedHashMap<>();

        BigDecimal totalReceivable = transactionRepository.sumReceivables(factoryId);
        BigDecimal totalPayable = transactionRepository.sumPayables(factoryId);

        List<ArApTransaction> overdueAR = transactionRepository.findOverdueReceivables(factoryId, LocalDate.now());
        List<ArApTransaction> overdueAP = transactionRepository.findOverduePayables(factoryId, LocalDate.now());

        BigDecimal overdueARAmount = overdueAR.stream()
                .map(ArApTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal overdueAPAmount = overdueAP.stream()
                .map(ArApTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        overview.put("totalReceivable", totalReceivable);
        overview.put("totalPayable", totalPayable);
        overview.put("netPosition", totalReceivable.subtract(totalPayable.abs()));
        overview.put("overdueReceivable", overdueARAmount);
        overview.put("overduePayable", overdueAPAmount);
        overview.put("overdueARCount", overdueAR.size());
        overview.put("overdueAPCount", overdueAP.size());

        // 按类型统计
        List<Object[]> stats = transactionRepository.statisticsByType(factoryId);
        List<Map<String, Object>> typeStats = new ArrayList<>();
        for (Object[] row : stats) {
            Map<String, Object> stat = new LinkedHashMap<>();
            stat.put("type", ((ArApTransactionType) row[0]).getDisplayName());
            stat.put("count", row[1]);
            stat.put("amount", row[2]);
            typeStats.add(stat);
        }
        overview.put("transactionsByType", typeStats);

        return overview;
    }

    @Override
    public boolean checkCreditLimit(String factoryId, String customerId, BigDecimal additionalAmount) {
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));

        if (customer.getCreditLimit() == null) {
            return true; // 无信用额度限制
        }

        BigDecimal currentBalance = customer.getCurrentBalance() != null ? customer.getCurrentBalance() : BigDecimal.ZERO;
        BigDecimal afterBalance = currentBalance.add(additionalAmount);
        return afterBalance.compareTo(customer.getCreditLimit()) <= 0;
    }

    // ==================== 内部方法 ====================

    private ArApTransaction buildTransaction(String factoryId, ArApTransactionType type,
                                              CounterpartyType counterpartyType, String counterpartyId,
                                              String counterpartyName, BigDecimal amount,
                                              BigDecimal balanceAfter, LocalDate dueDate,
                                              Long operatedBy, String remark) {
        ArApTransaction transaction = new ArApTransaction();
        transaction.setFactoryId(factoryId);
        transaction.setTransactionNumber(generateTransactionNumber(type));
        transaction.setTransactionType(type);
        transaction.setCounterpartyType(counterpartyType);
        transaction.setCounterpartyId(counterpartyId);
        transaction.setCounterpartyName(counterpartyName);
        transaction.setAmount(amount);
        transaction.setBalanceAfter(balanceAfter);
        transaction.setTransactionDate(LocalDate.now());
        transaction.setDueDate(dueDate);
        transaction.setOperatedBy(operatedBy);
        transaction.setRemark(remark);
        return transaction;
    }

    private String generateTransactionNumber(ArApTransactionType type) {
        String prefix = type.isAR() ? "AR" : "AP";
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long ts = System.currentTimeMillis() % 10000;
        return String.format("%s-%s-%04d", prefix, dateStr, ts);
    }

    private String getBucket(LocalDate dueDate, LocalDate today) {
        if (dueDate == null || !dueDate.isBefore(today)) {
            return "current";
        }
        long daysOverdue = ChronoUnit.DAYS.between(dueDate, today);
        if (daysOverdue <= 30) return "days1_30";
        if (daysOverdue <= 60) return "days31_60";
        if (daysOverdue <= 90) return "days61_90";
        if (daysOverdue <= 120) return "days91_120";
        return "days120plus";
    }
}
