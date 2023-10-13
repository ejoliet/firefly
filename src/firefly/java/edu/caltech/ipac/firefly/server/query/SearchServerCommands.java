/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.query;
/**
 * User: roby
 * Date: 3/5/12
 * Time: 12:26 PM
 */


import edu.caltech.ipac.firefly.core.background.ScriptAttributes;
import edu.caltech.ipac.firefly.data.*;
import edu.caltech.ipac.firefly.server.ServCommand;
import edu.caltech.ipac.firefly.server.db.EmbeddedDbUtil;
import edu.caltech.ipac.firefly.server.events.ServerEventManager;
import edu.caltech.ipac.firefly.server.packagedata.PackagedEmail;
import edu.caltech.ipac.firefly.server.packagedata.PackagingWorker;
import edu.caltech.ipac.firefly.server.util.QueryUtil;
import edu.caltech.ipac.firefly.util.event.Name;
import edu.caltech.ipac.table.DataGroupPart;
import edu.caltech.ipac.table.DataType;
import edu.caltech.ipac.table.JsonTableUtil;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.table.TableUtil;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.firefly.core.background.Job;
import edu.caltech.ipac.firefly.core.background.JobInfo;
import edu.caltech.ipac.firefly.core.background.JobManager;
import edu.caltech.ipac.firefly.core.background.ServCmdJob;
import org.json.simple.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URL;
import java.util.*;

import static edu.caltech.ipac.firefly.data.ServerParams.EMAIL;
import static edu.caltech.ipac.firefly.data.ServerParams.JOB_ID;
import static edu.caltech.ipac.util.StringUtils.isEmpty;

/**
 * @author Trey Roby
 */
public class SearchServerCommands {
    public static final String FORMAT= "FORMAT";    // response format.. use content-type

    public static class TableSearch extends ServCmdJob {
        public Job.Type getType() {
            JobInfo jInfo = getJobInfo();
            Type type = jInfo == null || jInfo.getType() == null ? Type.SEARCH : jInfo.getType();
            return type;
        }

        public String getLabel() {
            return getParams().getTableServerRequest().getTblTitle();
        }

        public void setJobId(String jobId) {
            getParams().insertJobId(jobId);
            super.setJobId(jobId);
        }

        public String doCommand(SrvParam params) throws Exception {
            TableServerRequest tsr = params.getTableServerRequest();
            String format = params.getOptional(FORMAT, "json");

            SearchProcessor processor = SearchManager.getProcessor(tsr.getRequestId());
            if (processor instanceof Job.Worker) setWorker((Job.Worker)processor);

            if (format.toLowerCase().contains("votable")) {
                ByteArrayOutputStream rval = new ByteArrayOutputStream();
                processor.writeData(rval, tsr, TableUtil.Format.VO_TABLE_TABLEDATA, TableUtil.Mode.displayed);
                return rval.toString();
            } else {
                DataGroupPart dgp = new SearchManager().getDataGroup(tsr, processor);
                JSONObject json = JsonTableUtil.toJsonTableModel(dgp, tsr);
                return json.toJSONString();
            }
        }
    }
    public static class AddOrUpdateColumn extends ServCommand {

        public boolean getCanCreateJson() { return false; }

        public String doCommand(SrvParam params) throws Exception {
            TableServerRequest tsr = params.getTableServerRequest();
            String cname = params.getRequired("cname");
            String dtype = params.getRequired("dtype");
            String desc = params.getOptional("desc");
            String units = params.getOptional("units");
            String ucd = params.getOptional("ucd");
            String precision = params.getOptional("precision");
            String editColName = params.getOptional("editColName");

            String expression = params.getOptional("expression");
            String preset = params.getOptional("preset");

            DataType dt = new DataType(cname, DataType.descToType(dtype), null, units, null, desc);
            if (ucd != null) dt.setUCD(ucd);
            if (dt.isFloatingPoint() && !isEmpty(precision)) dt.setPrecision(precision);

            try {
                EmbeddedDbProcessor processor = (EmbeddedDbProcessor)SearchManager.getProcessor(tsr.getRequestId());
                processor.addOrUpdateColumn(tsr, dt, expression, editColName, preset);
            } catch (ClassCastException cce) {
                throw new RuntimeException(String.format("Invalid Search Processor ID: %s", tsr.getRequestId()));
            }
            return "ok";
        }
    }

    public static class DeleteColumn extends ServCommand {

        public boolean getCanCreateJson() { return false; }

        public String doCommand(SrvParam params) throws Exception {
            TableServerRequest tsr = params.getTableServerRequest();
            String cname = params.getRequired("cname");
            try {
                EmbeddedDbProcessor processor = (EmbeddedDbProcessor)SearchManager.getProcessor(tsr.getRequestId());
                processor.deleteColumn(tsr, cname);
            } catch (ClassCastException cce) {
                throw new RuntimeException(String.format("Invalid Search Processor ID: %s", tsr.getRequestId()));
            }
            return "ok";
        }
    }

    public static class QueryTable extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            TableServerRequest treq = (TableServerRequest) params.getTableServerRequest().cloneRequest();
            treq.setStartIndex(0);
            treq.setPageSize(Integer.MAX_VALUE);
            treq.setParam(TableServerRequest.INCL_COLUMNS, params.getOptional(TableServerRequest.INCL_COLUMNS));
            treq.setFilters(StringUtils.asList(params.getOptional(TableServerRequest.FILTERS), ","));
            treq.setSqlFilter(params.getOptional(TableServerRequest.SQL_FILTER));
            String sortInfo = params.getOptional(TableServerRequest.SORT_INFO);
            if (!isEmpty(sortInfo)) {
                treq.setSortInfo(SortInfo.parse(sortInfo));
            }

            DataGroupPart page = new SearchManager().getDataGroup(treq);
            return JsonTableUtil.toJsonTableModel(page, treq).toJSONString();
        }
    }

    public static class SelectedValues extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String requestJson = params.getRequired(ServerParams.REQUEST);
            TableServerRequest treq = QueryUtil.convertToServerRequest(requestJson);
            try {
                List<String> cols = StringUtils.asList(params.getRequired("columnNames"), ",");
                String[] colsAry = cols == null ? null : cols.toArray(new String[cols.size()]);
                List<Integer> rows = StringUtils.convertToListInteger(params.getRequired("selectedRows"), ",");
                DataGroupPart page = EmbeddedDbUtil.getSelectedDataAsDGPart(treq, rows, colsAry);
                return JsonTableUtil.toJsonTableModel(page, treq).toJSONString();
            } catch (IOException e) {
                throw new DataAccessException("Unable to resolve a search processor for this request.  SelectedValues aborted.");
            }
        }
    }

    public static class GetJSONData extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String reqString = params.getRequired(ServerParams.REQUEST);
            ServerRequest request = ServerRequest.parse(reqString, new ServerRequest());
            return new SearchManager().getJSONData(request);
        }

    }

    public static class PackageRequest extends ServCmdJob {

        public Job.Type getType() { return Job.Type.PACKAGE; }

        public String doCommand(SrvParam params) throws Exception {
            PackagingWorker worker = new PackagingWorker();
            setWorker(worker);
            return worker.doCommand(params);
        }
    }

    public static class AddBgJob extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String jobId = params.getRequired(JOB_ID);
            JobInfo info = JobManager.setMonitored(jobId, true);
            return JobManager.toJson(info);
        }
    }

    public static class RemoveBgJob extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String jobId = params.getRequired(JOB_ID);
            JobInfo info = JobManager.setMonitored(jobId, false);
            return JobManager.toJson(info);
        }
    }

    public static class Cancel extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String jobId = params.getRequired(JOB_ID);
            JobInfo info = JobManager.abort(jobId, "Aborted by user");
            return JobManager.toJson(info);
        }
    }

    public static class SetEmail extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String email = params.getRequired(EMAIL);
            JobManager.list().forEach(jobInfo -> {
                String cEmail = jobInfo.getParams().get(EMAIL);
                    if (!email.equals(cEmail)) {
                        jobInfo.getParams().put(EMAIL, email);
                    }
                }
            );
            return "true";
        }
    }

    public static class UwsJobInfo extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String jobUrl = params.getOptional(UwsJobProcessor.JOB_URL);
            if (isEmpty(jobUrl)) {
                String jobId = params.getRequired(JOB_ID);
                JobInfo info = JobManager.getJobInfo(jobId);
                if (info == null || info.getType() != Job.Type.UWS) return null;
                jobUrl = info.getDataOrigin();
            }
            JobInfo uws = UwsJobProcessor.getUwsJobInfo(jobUrl);
            return JobManager.toJson(uws);
        }
    }

    public static class ResendEmail extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String id = params.getRequired(JOB_ID);
            String email = params.getOptional(EMAIL);
            JobInfo info = JobManager.sendEmail(id, email);
            return JobManager.toJson(info);
        }
    }

    public static class ReportUserAction extends ServCommand {

        public String doCommand(SrvParam params) throws Exception {
            String data= params.getRequired(ServerParams.DATA);
            ServerEvent userAction = new ServerEvent(Name.REPORT_USER_ACTION, ServerEvent.Scope.CHANNEL, data);
            ServerEventManager.fireEvent(userAction);
            return "true";
        }
    }

    public static class CreateDownloadScript extends ServCommand  {
        public boolean getCanCreateJson() { return false; }

        @Override
        public String doCommand(SrvParam params) throws Exception {
            String id = params.getRequired(JOB_ID);
            String file = params.getRequired(ServerParams.FILE);
            String source = params.getRequired(ServerParams.SOURCE);
            List<String> attStrList = params.getOptionalList(ServerParams.ATTRIBUTE);
            List<ScriptAttributes> attList= new ArrayList<ScriptAttributes>(5);
            for(String a : attStrList) {
                attList.add(Enum.valueOf(ScriptAttributes.class,a));
            }
            String url = PackagedEmail.makeScriptAndLink(JobManager.getJobInfo(id), source, attList);
            return url;
        }
    }


    public static class GetCapabilities extends ServCommand {
        public String doCommand(SrvParam params) throws Exception {
            String urlStr = params.getRequired(ServerParams.URL);
            URL url= new URL(urlStr);
            JSONObject map = new JSONObject();
            VosiCapabilityRetrieve.Capabilities vosiC= VosiCapabilityRetrieve.getCapabilities(url);
            if (vosiC==null) {
                map.put("success", false);
                return map.toJSONString();
            }
            VosiCapabilityRetrieve.TapCapability c= vosiC.tapCapability();
            JSONObject tapCapJson = new JSONObject();
            tapCapJson.put("canUpload", c.canUpload());
            tapCapJson.put("canUsePoint", c.canUsePoint());
            tapCapJson.put("canUseCircle", c.canUseCircle());
            tapCapJson.put("canUseBox", c.canUseBox());
            tapCapJson.put("canUsePolygon", c.canUsePolygon());
            tapCapJson.put("canUseRegion", c.canUseRegion());
            tapCapJson.put("canUseContains", c.canUseContains());
            tapCapJson.put("canUseIntersects", c.canUseIntersects());
            tapCapJson.put("canUseArea", c.canUseArea());
            tapCapJson.put("canUseCentroid", c.canUseCentroid());
            tapCapJson.put("canUseCoord1", c.canUseCoord1());
            tapCapJson.put("canUseCoord2", c.canUseCoord2());
            tapCapJson.put("canUseCoordSys", c.canUseCoordSys());
            tapCapJson.put("canUseDistance", c.canUseDistance());
            tapCapJson.put("foundGeoLanguageFeatures", c.foundGeoLanguageFeatures());
            
            JSONObject capJson = new JSONObject();
            capJson.put("tapCapability", tapCapJson);
            map.put("success", true);
            map.put("data", capJson);
            return map.toJSONString();
        }
    }





}

