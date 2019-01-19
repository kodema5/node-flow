# docker build -t node-flow-dev -f node-flow-dev.dockerfile .
# docker run --rm -it -v ${pwd}:/work node-flow-dev

FROM alpine

RUN apk update && apk upgrade \
    && apk add --no-cache \
        nodejs-current \
        npm

WORKDIR /work

COPY Flow.js node-flow.js package.json /node-flow/
RUN npm install -g nodemon /node-flow


# npm install (to initialize package.json)
# nodemon -L -e js,md --exec "node-flow -f test.md"

# ENTRYPOINT ["node-flow"]