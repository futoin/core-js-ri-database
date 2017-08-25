#!/bin/sh

if test -z "$TRAVIS"; then
    apt-get update

    # Install
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        mysql-server \
        postgresql

    # Listen on all interfaces
    sed -i -e s/127.0.0.1/0.0.0.0/g /etc/mysql/mysql.conf.d/mysqld.cnf
    #
    echo "listen_addresses = '*'" >> /etc/postgresql/9.5/main/postgresql.conf
    echo "host all all 0/0 md5" >> /etc/postgresql/9.5/main/pg_hba.conf

    # Restart services
    systemctl restart mysql.service postgresql.service
fi

# Add test users
mysql -e "CREATE USER 'ftntest'@'%'; GRANT ALL PRIVILEGES ON *.* TO 'ftntest'@'%'"
#
su -c 'psql -c "CREATE DATABASE test;"' postgres
su -c "psql -c \"CREATE ROLE ftntest WITH SUPERUSER LOGIN PASSWORD 'test'\"" postgres
