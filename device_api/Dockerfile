FROM python:3.13-slim-bookworm

ARG CI_COMMIT_SHA
ARG CI_COMMIT_SHORT_SHA
ARG BUILD_TIME

WORKDIR /code

# Prevents Python from writing pyc files to disc
ENV PYTHONDONTWRITEBYTECODE=1
# Prevents Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED=1

# ARG DEBIAN_FRONTEND=noninteractive
 
ENV TZ="Europe/Warsaw"

RUN apt-get update
RUN apt-get upgrade -y

RUN apt-get install -y tzdata locales
 
RUN ln -fs /usr/share/zoneinfo/Europe/Warsaw /etc/localtime

RUN echo "pl_PL.UTF-8 UTF-8" > /etc/locale.gen
 
RUN locale-gen

RUN apt-get install nano git procps cron curl -y
RUN apt-get install libpq-dev python3-dev gcc gettext -y
RUN apt-get install g++ cmake libbz2-dev libxml2-dev -y
RUN apt-get install pkg-config libxml2-dev libxmlsec1-dev libxmlsec1-openssl -y

COPY ../requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

ENV CI_COMMIT_SHA=$CI_COMMIT_SHA
ENV CI_COMMIT_SHORT_SHA=$CI_COMMIT_SHORT_SHA
ENV BUILD_TIME=$BUILD_TIME

COPY ./app_common /code/app_common
COPY ./device_api /code/device_api
COPY ./static /code/static
COPY ./config /code/config

## TODO only in debug
COPY ./tests/database /code/tests/database

EXPOSE 80

#HEALTHCHECK --interval=5m --timeout=2m --start-period=1m \
#   CMD curl -f --retry 6 --max-time 5 --retry-delay 10 --retry-max-time 60 "http://127.0.0.1:80/healthcheck" || bash -c 'kill -s 15 1 && (sleep 30; kill -s 9 1)'
CMD ["uvicorn", "device_api.main:app", "--host", "0.0.0.0","--port", "80", "--log-config", "/code/config/log.yaml", "--ssl-keyfile", "/certs/ca.key", "--ssl-certfile", "/certs/ca.crt", "--ssl-ca-certs", "/certs/ca.crt", "--ssl-cert-reqs", "1"]