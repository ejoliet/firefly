#!/bin/bash

NAME=${BUILD_TIME_NAME:-"ipac/firefly"}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-`echo $RANDOM | base64 | head -c 8`}

echo -e "\n!!============================================================"
echo "!!============================================================"
echo "!!==================== For Help =============================="
echo "!!"
echo "        docker run --rm ${NAME}:latest --help"
echo "!!"
echo "!!============================================================"
echo "!!============================================================"
echo -e "!!============================================================\n\n"

echo "========== Information:  you can set environment variable using -e on docker run line =====  "
echo 
echo "Environment Variables:"
echo "        Description                      Name                       Value"
echo "        -----------                      --------                   -----"
echo "        Admin username                   ADMIN_USER                 ${ADMIN_USER}"
echo "        Admin password                   ADMIN_PASSWORD             ${ADMIN_PASSWORD}"
echo "        Additional data path             VISUALIZE_FITS_SEARCH_PATH ${VISUALIZE_FITS_SEARCH_PATH}"
echo "        Clean internal(eg- 720m, 5h, 3d) CLEANUP_INTERVAL           ${CLEANUP_INTERVAL}"
echo
echo "Advanced environment variables:"
echo "        Run tomcat with debug            DEBUG                      ${DEBUG}"
echo "        Extra firefly properties(*)      PROPS                      ${PROPS}"
echo " (*) key=value pairs separated by spaces"
echo
echo "Ports: "
echo "        8080 - http"
echo "        5050 - debug"
echo
echo "Volume Mount Points: "
echo "    /firefly/logs             : logs directory"
echo "    /firefly/workarea         : work area for temporary files"
echo "    /firefly/shared-workarea  : work area for files that are shared between multiple instances of the application"
echo "    /external                 : default external data directory visible to Firefly"
echo
echo "  Less used:"
echo "    /firefly/config           : used to override application properties"
echo "    /firefly/logs/statistics  : directory for statistics logs"
echo "    /firefly/alerts           : alerts monitor will watch this directory for application alerts"
echo
echo "Command line options: "
echo "        --help  : show help message, examples, stop"
echo "        --debug : start in debug mode"
echo -e "\n"


#------------ if we are doing firefly.jar setup examples in the local/www directory
./setupFireflyExample.sh

if [ "$1" = "--help" ] || [ "$1" = "-help" ] || [ "$1" = "-h" ]; then
    sed "s:ipac/firefly:${NAME}:" ./start-examples.txt
    aWarFile=`ls ${CATALINA_HOME}/webapps/*.war | head -1 | awk '{print $1}'`
    onlyWar=`echo ${aWarFile} | awk -F/ '{print $NF}'`
    if [ "$onlyWar" = "firefly.war" ]; then
        cat ./customize-firefly.txt
    fi
    exit 0
fi

if [ -z ${VISUALIZE_FITS_SEARCH_PATH} ]; then
   VIS_PATH="/external"
else
   VIS_PATH="/external:${VISUALIZE_FITS_SEARCH_PATH}"
fi

#---------   CATALINA_OPTS must be exported for catalina.sh to pick them up
export CATALINA_OPTS="\
  -XX:InitialRAMPercentage=${INIT_RAM_PERCENT} \
  -XX:MaxRAMPercentage=${MAX_RAM_PERCENT} \
  -DADMIN_USER=${ADMIN_USER} \
  -DADMIN_PASSWORD=${ADMIN_PASSWORD} \
  -Dhost.name=${HOSTNAME} \
  -Dserver.cores=${JVM_CORES} \
  -Djava.net.preferIPv4Stack=true \
  -Dwork.directory=/firefly/workarea \
  -Dshared.work.directory=/firefly/shared-workarea \
  -Dserver_config_dir=/firefly/config \
  -Dstats.log.dir=/firefly/logs/statistics \
  -Dalerts.dir=/firefly/alerts \
  -Dvisualize.fits.search.path=${VIS_PATH} \
	"

#----- eval PROPS if exists.  key-value pairs are separated by spaces. therefore, it does not support values with spaces in it.
if [ ! -z "${PROPS}" ]; then
  jvmProps=`sed -r 's/( )+/ -D/g;s/^/-D/' <<< $PROPS`     # add -D to every key=val pair
  export CATALINA_OPTS="${CATALINA_OPTS} ${jvmProps}"
fi
# envVar with names matching 'PROPS_*'.
# A more advanced internal scheme to support secrets, quotes, and spaces in values
# Use '__' in key, to sub for '.' since '.' is not allowed in envVar.
for var in "${!PROPS_@}"; do
  prop=`sed 's/PROPS_//g;s/__/./g' <<< "$var"`
  export CATALINA_OPTS="${CATALINA_OPTS} -D$prop=${!var}"
done
#----- eval PROPS

# Java 9 introduces Modularity with module level security
# Firefly apps requires these module to be opened
CATALINA_OPTS="$CATALINA_OPTS \
    --illegal-access=warn \
  "


#------- start background scripts: cleanup
${CATALINA_HOME}/cleanup.sh /firefly/workarea /firefly/shared-workarea &

echo "launchTomcat.sh: Starting Tomcat"
if [ "$DEBUG" = "true" ] ||[ "$DEBUG" = "t" ] ||[ "$DEBUG" = "1" ] ||  \
   [ "$DEBUG" = "TRUE" ] || [ "$DEBUG" = "True" ] || [ "$1" = "--debug" ]; then
    exec ${CATALINA_HOME}/bin/catalina.sh jpda ${START_MODE}
else
    exec ${CATALINA_HOME}/bin/catalina.sh ${START_MODE}
fi
