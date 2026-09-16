# gitlearn 학습 환경.
# 이미지를 고정하는 이유: node:sqlite가 22.5부터 들어왔고 버전에 따라
# 플래그 요구가 달라진다. 학습자마다 노드 버전이 다른 걸 여기서 없앤다.
FROM node:22.18-alpine

# 레슨이 실제 git 저장소를 픽스처로 쓰므로 git이 있어야 한다.
RUN apk add --no-cache git

WORKDIR /app

# 의존성 레이어를 먼저 만들어 소스 변경 때마다 재설치하지 않게 한다.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 픽스처 저장소를 만들 때 쓸 기본 신원. 없으면 git commit이 거부된다.
RUN git config --global user.name  "gitlearn" \
 && git config --global user.email "gitlearn@example.local" \
 && git config --global init.defaultBranch main \
 && git config --global --add safe.directory '*'

EXPOSE 5173 4000

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
