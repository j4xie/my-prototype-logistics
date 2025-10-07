# 白垩纪食品溯源系统 - 后端API Docker镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# 复制package文件
COPY package*.json ./
COPY prisma/ ./prisma/

# 安装依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 复制源代码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 创建必要目录
RUN mkdir -p uploads/mobile temp logs && \
    chown -R nextjs:nodejs uploads temp logs

# 设置权限
USER nextjs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# 启动应用
CMD ["npm", "start"]