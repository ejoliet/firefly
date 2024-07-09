/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.db;

import edu.caltech.ipac.firefly.server.db.spring.JdbcFactory;
import edu.caltech.ipac.table.DataType;
import edu.caltech.ipac.util.decimate.DecimateKey;

import java.io.File;
import java.util.List;

/**
 * @author loi
 * @version $Id: DbInstance.java,v 1.3 2012/03/15 20:35:40 loi Exp $
 */
public class HsqlDbAdapter extends BaseDbAdapter implements DbAdapter.DbAdapterCreator {
    public static final String NAME = "hsql";
    public static final String DRIVER = "org.hsqldb.jdbc.JDBCDriver";
    private static final List<String> SUPPORTS = List.of(NAME);
    private static final String[] DB_FILES = new String[]{".properties",".script",".log",".data",".lck",".backup"};


    private static final String [] customFunctions = {
            "CREATE FUNCTION decimate_key(xVal DOUBLE, yVal DOUBLE, xMin DOUBLE, yMin DOUBLE, nX INT, nY INT, xUnit DOUBLE, yUnit DOUBLE)\n" +
                    "RETURNS CHAR VARYING(20)\n" +
                    "RETURNS NULL ON NULL INPUT\n"+
                    "LANGUAGE JAVA DETERMINISTIC NO SQL\n" +
                    "EXTERNAL NAME 'CLASSPATH:edu.caltech.ipac.firefly.server.db.HsqlDbAdapter.getDecimateKey'\n"
            ,
            "CREATE FUNCTION lg(val DOUBLE)\n" +
                    "RETURNS DOUBLE\n" +
                    "RETURNS NULL ON NULL INPUT\n" +
                    "LANGUAGE JAVA DETERMINISTIC NO SQL\n" +
                    "EXTERNAL NAME 'CLASSPATH:java.lang.Math.log10'\n"
    };

    /**
     * used by DbAdapterCreator only
     */
    HsqlDbAdapter() {
        super(null);
    }
    public HsqlDbAdapter(File dbFile) { super(dbFile); }

    public DbAdapter create(File dbFile) {
        return canHandle(dbFile) ? new HsqlDbAdapter(dbFile) : null;
    }

    List<String> getSupportedExts() {
        return  SUPPORTS;
    }

    public String getName() {
        return NAME;
    }
    protected static List<String> supportFileExtensions() { return SUPPORTS; }

    protected EmbeddedDbInstance createDbInstance() {
        String dbUrl = String.format("jdbc:hsqldb:file:%s;hsqldb.log_data=false;sql.syntax_ora=true;sql.ignore_case=true;sql.double_nan=false", getDbFile().getPath());
        EmbeddedDbInstance dbInst = new EmbeddedDbInstance(getName(), this, dbUrl, DRIVER);
        dbInst.consumeProps(String.format("%s=%s", DbInstance.USE_REAL_AS_DOUBLE, true));
        return dbInst;
    }

    public String createTableFromSelect(String tblName, String selectSql) {
        return String.format("CREATE TABLE %s AS (%s) WITH DATA", tblName, selectSql);
    }

    protected void shutdown(EmbeddedDbInstance db) {
        JdbcFactory.getTemplate(db).execute("SHUTDOWN");
        File f = new File(db.getDbFile() + ".lck");
        if (f.exists()) f.delete();
    }

    protected void removeDbFile() {
        if (getDbFile().exists()) getDbFile().delete();
        for(String fname : DB_FILES) {
            File f = new File(getDbFile() + fname);
            if (f.exists()) f.delete();
        }
    }

    void createUDFs() {
        for (String cf : customFunctions) {
            try {
                execUpdate(cf);
            } catch (Exception ex) {
                LOGGER.error("Fail to create custom function:" + cf);
            }
        }
    }

    String longStringDbType() {
        return "LONGVARCHAR";
    }

    String createAuxDataSql(String forTable) {
        return super.createAuxDataSql(forTable).replaceAll(super.longStringDbType(), longStringDbType());
    }

    String createMetaSql(String forTable) {
        return super.createMetaSql(forTable).replaceAll(super.longStringDbType(), longStringDbType());
    }

    String createDDSql(String forTable) {
        return super.createDDSql(forTable).replaceAll(super.longStringDbType(), longStringDbType());
    }

    @Override
    String createDataSql(DataType[] dtTypes, String tblName) {
        return super.createDataSql(dtTypes, tblName);
    }

    public static String getDecimateKey(double xVal, double yVal, double xMin, double yMin, int nX, int nY, double xUnit, double yUnit) {
        return new DecimateKey(xMin, yMin, nX, nY, xUnit, yUnit).getKey(xVal, yVal);
    }


// this is a list of HSQLDB keywords
//    private static final List<String> KEYWORDS = Arrays.asList("ALL", "AND", "ANY", "AS", "AT", "AVG", "BETWEEN", "BOTH", "BY", "CALL", "CASE", "CAST", "COALESCE", "CORRESPONDING", "CONVERT", "COUNT", "CREATE",
//            "CROSS", "DEFAULT", "DISTINCT", "DROP", "ELSE", "EVERY", "EXISTS", "EXCEPT", "FOR", "FROM", "FULL", "GRANT", "GROUP", "HAVING", "IN", "INNER", "INTERSECT", "INTO", "IS", "JOIN", "LEFT", "LEADING",
//            "LIKE", "MAX", "MIN", "NATURAL", "NOT", "NULLIF", "ON", "ORDER", "OR", "OUTER", "PRIMARY", "REFERENCES", "RIGHT", "SELECT", "SET", "SOME", "STDDEV_POP", "STDDEV_SAMP", "SUM", "TABLE", "THEN", "TO",
//            "TRAILING", "TRIGGER", "UNION", "UNIQUE", "USING", "VALUES", "VAR_POP", "VAR_SAMP", "WHEN", "WHERE", "WITH");
}
