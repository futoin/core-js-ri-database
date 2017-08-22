
Vagrant.configure("2") do |config|
    config.vm.define 'db' do |node|
        node.vm.provider "virtualbox" do |v|
            v.memory = 512
        end
        node.vm.box = "bento/ubuntu-16.04"

        node.vm.network "forwarded_port", guest: 3306, host: 3306, host_ip: "127.0.0.1"
        node.vm.network "forwarded_port", guest: 5432, host: 5432, host_ip: "127.0.0.1"

        node.vm.provision "shell", inline: <<-SHELL
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server postgresql
            #
            sed -i -e s/127.0.0.1/0.0.0.0/g /etc/mysql/mysql.conf.d/mysqld.cnf
            #
            echo "listen_addresses = '*'" >> /etc/postgresql/9.5/main/postgresql.conf
            echo "host all all 0/0 md5" >> /etc/postgresql/9.5/main/pg_hba.conf
            #
            systemctl restart mysql.service postgresql.service
            #
            mysql -e "CREATE USER 'root'@'%'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'"
            #
            su -c ;'sql -c "CREATE DATABASE test;"' postgres
            su -c "psql -c \"CREATE ROLE test WITH SUPERUSER LOGIN PASSWORD 'test'\"" postgres
        SHELL
    end
end
