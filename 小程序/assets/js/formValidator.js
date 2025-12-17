/*
 * 表单验证工具 - 溯源商城高保真原型系统
 */

class FormValidator {
  /**
   * 验证表单
   * @param {HTMLFormElement} formEl - 表单元素
   * @returns {Array} 错误列表
   */
  static validate(formEl) {
    const errors = [];

    // 获取所有必填字段
    const requiredFields = formEl.querySelectorAll('[required]');
    requiredFields.forEach(field => {
      const value = field.value.trim();
      const label = field.dataset.label || field.name || '该字段';

      if (!value) {
        errors.push({
          field: field.name,
          message: `${label}不能为空`
        });
      }
    });

    // 手机号验证
    const phoneFields = formEl.querySelectorAll('input[type="tel"]');
    phoneFields.forEach(field => {
      const value = field.value.trim();
      if (value && !/^1[3-9]\d{9}$/.test(value)) {
        const label = field.dataset.label || '手机号';
        errors.push({
          field: field.name,
          message: `请输入正确的${label}`
        });
      }
    });

    // 邮箱验证
    const emailFields = formEl.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
      const value = field.value.trim();
      if (value && !/^[\w.-]+@[\w.-]+\.\w+$/.test(value)) {
        const label = field.dataset.label || '邮箱地址';
        errors.push({
          field: field.name,
          message: `请输入正确的${label}`
        });
      }
    });

    // 数字验证
    const numberFields = formEl.querySelectorAll('input[type="number"]');
    numberFields.forEach(field => {
      const value = field.value.trim();
      if (value) {
        const num = parseFloat(value);
        const min = field.min ? parseFloat(field.min) : null;
        const max = field.max ? parseFloat(field.max) : null;
        const label = field.dataset.label || '数值';

        if (isNaN(num)) {
          errors.push({
            field: field.name,
            message: `${label}必须是数字`
          });
        } else {
          if (min !== null && num < min) {
            errors.push({
              field: field.name,
              message: `${label}不能小于${min}`
            });
          }
          if (max !== null && num > max) {
            errors.push({
              field: field.name,
              message: `${label}不能大于${max}`
            });
          }
        }
      }
    });

    // 密码验证
    const passwordFields = formEl.querySelectorAll('input[type="password"][data-validate="password"]');
    passwordFields.forEach(field => {
      const value = field.value;
      if (value && value.length < 6) {
        const label = field.dataset.label || '密码';
        errors.push({
          field: field.name,
          message: `${label}长度不能少于6位`
        });
      }
    });

    // 确认密码验证
    const confirmPasswordField = formEl.querySelector('input[name="confirmPassword"]');
    if (confirmPasswordField) {
      const passwordField = formEl.querySelector('input[type="password"][name="password"]');
      if (passwordField && confirmPasswordField.value !== passwordField.value) {
        errors.push({
          field: 'confirmPassword',
          message: '两次输入的密码不一致'
        });
      }
    }

    return errors;
  }

  /**
   * 显示错误消息
   * @param {HTMLFormElement} formEl - 表单元素
   * @param {Array} errors - 错误列表
   */
  static showErrors(formEl, errors) {
    // 清除旧错误
    formEl.querySelectorAll('.error-message').forEach(el => el.remove());
    formEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // 显示新错误
    errors.forEach(error => {
      const field = formEl.querySelector(`[name="${error.field}"]`);
      if (field) {
        // 添加错误样式
        field.classList.add('error');

        // 添加错误消息
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = error.message;

        // 插入错误消息
        const formGroup = field.closest('.form-group');
        if (formGroup) {
          formGroup.appendChild(errorEl);
        } else {
          field.parentElement.appendChild(errorEl);
        }
      }
    });

    // 滚动到第一个错误字段
    if (errors.length > 0) {
      const firstErrorField = formEl.querySelector('.error');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
    }
  }

  /**
   * 清除所有错误
   * @param {HTMLFormElement} formEl - 表单元素
   */
  static clearErrors(formEl) {
    formEl.querySelectorAll('.error-message').forEach(el => el.remove());
    formEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }

  /**
   * 实时验证（输入时）
   * @param {HTMLFormElement} formEl - 表单元素
   */
  static enableRealTimeValidation(formEl) {
    const fields = formEl.querySelectorAll('input, textarea, select');

    fields.forEach(field => {
      field.addEventListener('blur', () => {
        // 验证单个字段
        const errors = this.validate(formEl);
        const fieldErrors = errors.filter(e => e.field === field.name);

        // 清除该字段的旧错误
        const oldError = field.parentElement.querySelector('.error-message');
        if (oldError) {
          oldError.remove();
        }
        field.classList.remove('error');

        // 显示新错误（如果有）
        if (fieldErrors.length > 0) {
          this.showErrors(formEl, fieldErrors);
        }
      });

      // 输入时清除错误
      field.addEventListener('input', () => {
        if (field.classList.contains('error')) {
          const errorEl = field.parentElement.querySelector('.error-message');
          if (errorEl) {
            errorEl.remove();
          }
          field.classList.remove('error');
        }
      });
    });
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidator;
}
