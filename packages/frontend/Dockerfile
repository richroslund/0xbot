FROM node:10.18.1-alpine3.11 as builder
RUN npm config set unsafe-perm true && yarn global add cross-env
RUN apk update && apk add ca-certificates make git dep gcc build-base musl linux-headers --no-cache
RUN apk add --no-cache python && \
    python -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip install --upgrade pip setuptools && \
    rm -r /root/.cache
WORKDIR /usr/src/app

COPY ./ ./
RUN yarn

RUN yarn build


FROM nginx:alpine
COPY --from=builder /usr/src/app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY deployments/nginx.conf /etc/nginx/conf.d
COPY deployments/mime.types /etc/nginx/mime.types
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]