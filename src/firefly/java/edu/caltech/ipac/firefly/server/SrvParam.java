/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server;
/**
 * User: roby
 * Date: 12/19/12
 * Time: 11:46 AM
 */


import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.data.TableServerRequest;
import edu.caltech.ipac.firefly.server.util.QueryUtil;
import edu.caltech.ipac.firefly.server.visualize.VisJsonSerializer;
import edu.caltech.ipac.firefly.visualize.PlotState;
import edu.caltech.ipac.firefly.visualize.WebPlotRequest;
import edu.caltech.ipac.table.TableUtil;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.visualize.plot.ImagePt;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * @author Trey Roby
 */
public class SrvParam {

    private final Map<String, String[]> paramMap;

    public SrvParam(Map<String, String[]> paramMap) { this.paramMap=new HashMap<>(paramMap); }


    public Map<String, String[]> getParamMap() {
        return paramMap;
    }

    public static SrvParam makeSrvParamSimpleMap(Map<String, String> map) {
        Map<String, String[]> targetMap= new HashMap<>();
        for( Map.Entry<String,String> entry : map.entrySet()) {
            targetMap.put(entry.getKey(), new String[] {entry.getValue()} );
        }
        return new SrvParam(targetMap);
    }

    public void setParam(String key, String value) {
        paramMap.put(key, new String[] {value});
    }

    public void addParams(Map<String, String> map) {
        for( Map.Entry<String,String> entry : map.entrySet()) {
            if (!paramMap.containsKey(entry.getKey())) {
                paramMap.put(entry.getKey(), new String[] {entry.getValue()} );
            }
        }
    }

    public boolean contains(String key) { return paramMap.containsKey(key); }

    public String getCommandKey() {
        return getRequired(ServerParams.COMMAND);
    }

    /**
     * Look for the ServerParams.STATE key and parse the value into a PlotState Object
     * Throw an exception if it is not found
     * @return a PlotState object
     */
    public PlotState getState() {
        PlotState state= null;
        String stateStr= getRequired(ServerParams.STATE);
        if (stateStr!=null) state= VisJsonSerializer.deserializePlotStateFromString(stateStr);
        if (state == null) {
            throw new IllegalArgumentException("parameter in wrong format: state, (see PlotState.serialize()");
        }
        return state;
    }

    public PlotState getState(int idx, boolean required) {
        String key=  ServerParams.STATE+idx;
        String stateStr= required? getRequired(key) : getOptional(key);
        PlotState state= null;
        if (stateStr!=null) state= VisJsonSerializer.deserializePlotStateFromString(stateStr);
//        PlotState state= PlotState.parse(getRequired(ServerParams.STATE+idx));
        if (state == null && required) {
            throw new IllegalArgumentException("parameter in wrong format: state"+idx+", (see PlotState.serialize()");
        }
        return state;
    }

    public PlotState[] getStateAry() {
        List<PlotState> stateList= new ArrayList<PlotState>();
        PlotState state= getState(0,true);
        stateList.add(state);
        for(int i=1;(state!=null); i++) {
            state= getState(i,false);
            if (state!=null) stateList.add(state);
        }
        return stateList.toArray(new PlotState[stateList.size()]);
    }

    public List<WebPlotRequest> getRequestList() {
        List<WebPlotRequest> reqList= new ArrayList<WebPlotRequest>();
        WebPlotRequest wpr= getRequiredWebPlotRequest(ServerParams.REQUEST+"0");
        reqList.add(wpr);
        for(int i=1;(wpr!=null); i++) {
            wpr= getOptionalWebPlotRequest(ServerParams.REQUEST+i);
            if (wpr!=null) reqList.add(wpr);
        }
        return reqList;
    }


    /**
     * Look for the ServerParams.ID key and return the string value
     * Throw an exception if it is not found
     * @return in ID value
     */
    public String getID() { return getRequired(ServerParams.ID); }

    /**
     * Look for the ServerParams.ID keys and a list of values
     * Throw an exception if at least one is not found
     * @return in ID values
     */
    public List<String> getIDList() { return getRequiredList(ServerParams.ID); }


    public String getRequired(String key) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            return ary[0];
        }
        else {
            throw new IllegalArgumentException("missing parameter: "+ key);
        }
    }

    public List<String> getRequiredList(String key) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            return Arrays.asList(ary);
        }
        else {
            throw new IllegalArgumentException("missing parameter: "+ key);
        }
    }

    public List<String> getOptionalList(String key) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            return Arrays.asList(ary);
        }
        else {
            return Collections.emptyList();
        }
    }

    public String getOptional(String key) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            return ary[0];
        }
        else {
            return null;
        }
    }

    public float getOptionalFloat(String key, float defValue) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            try {
                return Float.parseFloat(ary[0]);
            } catch (NumberFormatException e) {
                return defValue;
            }
        }
        else {
            return defValue;
        }
    }

    public int getOptionalInt(String key, int defValue) {
        String ary[]= paramMap.get(key);
        if (ary != null && ary.length>0) {
            try {
                return Integer.parseInt(ary[0]);
            } catch (NumberFormatException e) {
                return defValue;
            }
        }
        else {
            return defValue;
        }
    }

    public int getRequiredInt(String key) {
        String v= getRequired(key);
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "parameter could not be parsed as int: parameter: "+ key + ", value: "+v, e);
        }
    }

    public float getRequiredFloat(String key) {
        String v= getRequired(key);
        try {
            return Float.parseFloat(v);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "parameter could not be parsed as float: parameter: "+ key + ", value: "+v, e);
        }
    }

    public double getRequiredDouble(String key) {
        String v= getRequired(key);
        try {
            return Double.parseDouble(v);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "parameter could not be parsed as double: parameter: "+ key + ", value: "+v, e);
        }
    }

    public ImagePt getRequiredImagePt(String key) {
        String v= getRequired(key);
        try {
            return ImagePt.parse(v);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "parameter could not be parsed as ImagePt: parameter: "+ key + ", value: "+v, e);
        }
    }

    public boolean getOptionalBoolean(String key, boolean defval) {
        String v= getOptional(key);
        return v==null ? defval : Boolean.valueOf(v);
    }

    public boolean getRequiredBoolean(String key) {
        return Boolean.valueOf(getRequired(key));
    }

    public WebPlotRequest getOptionalWebPlotRequest(String key) {
        return WebPlotRequest.parse(getOptional(key));
    }
    public WebPlotRequest getRequiredWebPlotRequest(String key) {
        return WebPlotRequest.parse(getRequired(key));
    }


//====================================================================
//  Table related convenience methods
//====================================================================
    public TableServerRequest getTableServerRequest() {
        return getTableServerRequest(ServerParams.REQUEST);
    }

    public TableServerRequest getTableServerRequest(String key) {
        String reqString = getRequired(key);
        return QueryUtil.convertToServerRequest(reqString);
    }

    public TableUtil.Format getTableFormat() {
        final String fileFormat = getOptional("file_format").toLowerCase();

        Map<String, TableUtil.Format> allFormats = TableUtil.getAllFormats();

        String formatInMap;
        if (StringUtils.isEmpty(fileFormat)) {
            formatInMap = "ipac";
        } else {
            Object[] formats = allFormats.keySet().stream()
                    .filter((t) -> fileFormat.equals(t))
                    .toArray();
            formatInMap = (formats.length != 1) ? "ipac" : (String)formats[0];
        }

        return allFormats.get(formatInMap);
    }
}

