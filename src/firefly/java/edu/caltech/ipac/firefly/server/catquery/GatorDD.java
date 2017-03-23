/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.catquery;

import edu.caltech.ipac.astro.DataGroupQueryStatement;
import edu.caltech.ipac.firefly.core.EndUserException;
import edu.caltech.ipac.firefly.data.CatalogRequest;
import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.data.TableServerRequest;
import edu.caltech.ipac.firefly.data.table.TableMeta;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.db.DbAdapter;
import edu.caltech.ipac.firefly.server.db.DbInstance;
import edu.caltech.ipac.firefly.server.db.TableDbUtil;
import edu.caltech.ipac.firefly.server.db.spring.JdbcFactory;
import edu.caltech.ipac.firefly.server.db.spring.mapper.DataGroupUtil;
import edu.caltech.ipac.firefly.server.query.DataAccessException;
import edu.caltech.ipac.firefly.server.query.DbProcessor;
import edu.caltech.ipac.firefly.server.query.ParamDoc;
import edu.caltech.ipac.firefly.server.query.SearchManager;
import edu.caltech.ipac.firefly.server.query.SearchProcessorImpl;
import edu.caltech.ipac.firefly.server.util.StopWatch;
import edu.caltech.ipac.firefly.server.util.ipactable.DataGroupPart;
import edu.caltech.ipac.firefly.server.util.ipactable.TableDef;
import edu.caltech.ipac.util.AppProperties;
import edu.caltech.ipac.util.DataGroup;
import edu.caltech.ipac.util.DataType;
import edu.caltech.ipac.util.StringUtils;
import org.apache.commons.codec.digest.DigestUtils;

import java.io.File;
import java.io.IOException;
import java.util.List;
/**
 * User: roby
 * Date: Jul 29, 2010
 * Time: 2:24:20 PM
 */


/**
 * This is a wrapper around GatorDDImpl.  It uses the original code to retrieve Gator's DD
 * information, but stores it into a database.  Unlike our single-results per database,
 * this database will contains all of the DD information retrieved by GatorDDImpl.
 */
@SearchProcessorImpl(id = "GatorDD", params =
        {@ParamDoc(name = CatalogRequest.CATALOG, desc = "the catalog name to search"),
                @ParamDoc(name = CatalogRequest.DATABASE, desc = "the database to search against"),
                @ParamDoc(name = CatalogRequest.SERVER, desc = "i am not sure what this one means"),
                @ParamDoc(name = CatalogRequest.DD_FILE, desc = "the dd file to use"),
                @ParamDoc(name = CatalogRequest.DD_SHORT, desc = "use the short form on a cat dd query, optional: default true"),
                @ParamDoc(name = CatalogRequest.DD_ONLIST, desc = "search catalog that is on list, optional: default true"),
                @ParamDoc(name = CatalogRequest.GATOR_HOST, desc = "The hostname for the gator URL. optional: almost never used"),
                @ParamDoc(name = CatalogRequest.SERVICE_ROOT, desc = "the part of the URL string that specifies the service and first params. " +
                        "optional: almost never used")
        })
public class GatorDD extends DbProcessor {

    public FileInfo createDbFile(TableServerRequest treq) throws DataAccessException {
        DbAdapter dbAdapter = DbAdapter.getAdapter(treq);
        File dbFile = new File(ServerContext.getPermWorkDir(), "GatorDD." + dbAdapter.getName());
        DataGroup dd = new DataGroup("DD for GatorDD", new DataType[]{
                new DataType("name", String.class),
                new DataType("description", String.class),
                new DataType("units", String.class),
                new DataType("indx", String.class),
                new DataType("dbtype", String.class),
                new DataType("tableflg", Integer.class),
                new DataType("sel", String.class)
        });
        TableDbUtil.createDDTbl(dbFile, dd, dbAdapter);
        TableDbUtil.setDbMetaInfo(treq, DbAdapter.getAdapter(treq), dbFile);
        return new FileInfo(dbFile);
    }

    @Override
    protected DataGroupPart getDataset(TableServerRequest treq, File dbFile) throws DataAccessException {
        DbAdapter dbAdapter = DbAdapter.getAdapter(treq);
        DbInstance dbInstance =  dbAdapter.getDbInstance(dbFile);
        String tblName = "ds_" + DigestUtils.md5Hex(StringUtils.toString(treq.getSearchParams(), "|"));

        String tblExists = String.format("select count(*) from %s", tblName);
        try {
            JdbcFactory.getSimpleTemplate(dbInstance).queryForInt(tblExists);
        } catch (Exception e) {
            // does not exists.. fetch data and populate
            fetchDataIntoTable(treq, tblName, dbFile, dbAdapter);
        }

        treq.setParam(TableServerRequest.SQL_FROM, tblName);
        treq.setPageSize(Integer.MAX_VALUE);
        String sql = String.format("%s %s %s", dbAdapter.selectPart(treq), dbAdapter.fromPart(treq), dbAdapter.wherePart(treq));
        sql = dbAdapter.translateSql(sql);

        DataGroup dg = TableDbUtil.runQuery(dbAdapter, dbFile, sql);
        TableDef tm = new TableDef();
        tm.setStatus(DataGroupPart.State.COMPLETED);
        return new DataGroupPart(tm, dg, treq.getStartIndex(), dg.size());
    }

    private void fetchDataIntoTable(TableServerRequest treq, String tblName, File dbFile, DbAdapter dbAdapter) throws DataAccessException {
        TableServerRequest ntreq = (TableServerRequest) treq.cloneRequest();
        ntreq.keepBaseParamOnly();
        DataGroupPart dgp = new GatorDDImpl().getData(treq);
        TableDbUtil.createDataTbl(dbFile, dgp.getData(), dbAdapter, tblName);
    }
}


/**
 * @author Trey Roby
 */
class GatorDDImpl extends BaseGator {

    private static final String DEF_DD_SERVICE = AppProperties.getProperty("irsa.gator.service.dd",
            "/cgi-bin/Gator/nph-dd");
    private static final String DEF_DD_HOST = AppProperties.getProperty("irsa.gator.dd.hostname",
            "irsa.ipac.caltech.edu");
    public static final String BASE_NAME = "gator-dd-pre";
    private final static String START_PARAM_MODE_ASCII = "mode=ascii";


    protected String getDefService() {
        return DEF_DD_SERVICE;
    }

    @Override
    protected String getDefHost(){
        return DEF_DD_HOST;
    }

    protected String getFileBaseName(CatalogRequest req) throws EndUserException {
        return BASE_NAME;
    }

    @Override
    protected File createFile(TableServerRequest request) throws IOException {
        try {
            return File.createTempFile(getFileBaseName((CatalogRequest) request), ".tbl", ServerContext.getPermWorkDir());
        } catch (EndUserException e) {
            return null;
        }
    }

    protected String getParams(CatalogRequest req) throws EndUserException, IOException {
        StringBuffer sb = new StringBuffer(70);
        sb.append("?");
        sb.append(START_PARAM_MODE_ASCII);
        requiredParam(sb, CatalogRequest.CATALOG, req.getQueryCatName());
        optionalParam(sb, CatalogRequest.DD_SHORT, req.getDDShort());

        boolean ddOnList = req.getDDOnList();
        optionalParam(sb, CatalogRequest.DD_ONLIST, ddOnList);

        if (!ddOnList) {
            requiredParam(sb, CatalogRequest.SERVER, req.getServer());
            requiredParam(sb, CatalogRequest.DATABASE, req.getDatabase());
            optionalParam(sb, CatalogRequest.DD_FILE, req.getDDFile());
            optionalParam(sb, CatalogRequest.DBMS, req.getParam(CatalogRequest.DBMS));
        }
        optionalParam(sb, CatalogRequest.GATOR_MISSION, req.getGatorMission());

        return sb.toString();
    }

    @Override
    public void prepareTableMeta(TableMeta meta, List<DataType> columns, ServerRequest request) {
        super.prepareTableMeta(meta, columns, request);
        meta.setAttribute("col.indx.Visibility", "hide");
        meta.setAttribute("col.dbtype.Visibility", "hide");
        meta.setAttribute("col.tableflg.Visibility", "hide");
        meta.setAttribute("col.sel.Visibility", "hide");
    }

    protected File modifyData(File f, CatalogRequest req) throws Exception {
        File inFile = File.createTempFile("gator-dd", ".tbl", ServerContext.getPermWorkDir());
        String forStmt;
        if (req.getDDShort()) {
            //short form
            forStmt = " for tableflg in 0,2";
        } else {
            //long form
            forStmt = " for tableflg in 0,1,2";
        }

        String str = "select col name, description, units, indx, dbtype, tableflg, sel from " + f.getPath() + " into " + inFile.getPath() + forStmt + " and sel ! h with complete_header";
        DataGroupQueryStatement dgqs = DataGroupQueryStatement.parseStatement(str);
        dgqs.execute();
        File retFile = dgqs.getIntoFile();
        f.delete();

        return retFile;
    }

}

