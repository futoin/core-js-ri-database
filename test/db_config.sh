#!/bin/sh

if test -z "$TRAVIS"; then
    apt-get update

    # Install
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        default-mysql-server \
        postgresql

    # Listen on all interfaces
    sed -i -e s/127.0.0.1/0.0.0.0/g /etc/mysql/mysql.conf.d/mysqld.cnf
    #
    echo "listen_addresses = '*'" >> /etc/postgresql/17/main/postgresql.conf
    echo "host all all 0/0 scram-sha-256" >> /etc/postgresql/17/main/pg_hba.conf

    # Restart services
    systemctl restart mysql.service postgresql.service
fi

# Add test users
mysql -e "CREATE USER 'ftntest'@'%'; GRANT ALL PRIVILEGES ON *.* TO 'ftntest'@'%'"
#
su -c 'psql -c "CREATE DATABASE test;"' postgres
su -c "psql -c \"CREATE ROLE ftntest WITH SUPERUSER LOGIN PASSWORD 'test'\"" postgres
