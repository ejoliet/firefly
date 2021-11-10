/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.rpc;
/**
 * User: roby
 * Date: 2/8/12
 * Time: 1:27 PM
 */

import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.server.ServCommand;
import edu.caltech.ipac.firefly.server.ServerCommandAccess;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.firefly.server.servlets.CommandService;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.server.visualize.VisJsonSerializer;
import edu.caltech.ipac.firefly.server.visualize.VisServerOps;
import edu.caltech.ipac.firefly.server.visualize.WebPlotResultSerializer;
import edu.caltech.ipac.firefly.server.visualize.imagesources.ImageMasterData;
import edu.caltech.ipac.firefly.visualize.Band;
import edu.caltech.ipac.firefly.visualize.PlotState;
import edu.caltech.ipac.firefly.visualize.StretchData;
import edu.caltech.ipac.firefly.visualize.WebPlotRequest;
import edu.caltech.ipac.firefly.visualize.WebPlotResult;
import edu.caltech.ipac.visualize.plot.ImagePt;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.channels.Channels;
import java.nio.channels.WritableByteChannel;
import java.util.ArrayList;
import java.util.List;

/**
 * @author Trey Roby
 */
public class VisServerCommands {

    public static class FileFluxCmdJson extends ServCommand {
        public String doCommand(SrvParam sp) throws IllegalArgumentException {


            PlotState stateAry[]= sp.getStateAry();
            PlotState state= stateAry[0];
            ImagePt pt = sp.getRequiredImagePt("pt");
            String[] res= VisServerOps.getFlux(stateAry,pt);


            JSONObject obj= new JSONObject();
            obj.put("JSON", true);
            obj.put("success", true);

            JSONObject data= new JSONObject();
            Band[] bands = state.getBands();
            int resultCnt=0;
            for (;resultCnt<res.length && resultCnt<bands.length; resultCnt++){
                data.put(bands[resultCnt].toString(), res[resultCnt]);
            }


            if (stateAry.length>1) {
                for(int i=1; (i<stateAry.length);i++) {
                    data.put("overlay-"+(i-1), res[resultCnt++]);
                }
            }
            JSONArray wrapperAry= new JSONArray();
            obj.put("data", data);
            wrapperAry.add(obj);

            return wrapperAry.toJSONString();
        }

    }



    public static class GetWebPlotCmd extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {


            WebPlotRequest red  =     sp.getOptionalWebPlotRequest(ServerParams.RED_REQUEST);
            WebPlotRequest green=     sp.getOptionalWebPlotRequest(ServerParams.GREEN_REQUEST);
            WebPlotRequest blue =     sp.getOptionalWebPlotRequest(ServerParams.BLUE_REQUEST);
            WebPlotRequest nobandReq= sp.getOptionalWebPlotRequest(ServerParams.NOBAND_REQUEST);

            boolean threeColor;

            if (nobandReq != null) {
                if (CommandService.DEBUG) {
                    Logger.debug("noband req: " + (nobandReq!=null ? nobandReq.toString() : "null"));
                }
                threeColor = false;
            } else if (red != null || green != null || blue != null) {
                threeColor = true;
            } else {
                throw new IllegalArgumentException("No request specified");
            }

            WebPlotResult result = threeColor ? VisServerOps.create3ColorPlot(red, green, blue) :
                                                VisServerOps.createPlot(nobandReq);

            return WebPlotResultSerializer.createJson(result);
        }
    }

    public static class GetWebPlotGroupCmd extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {


            String key = sp.getRequired(ServerParams.PROGRESS_KEY);
            List<WebPlotRequest> reqList= sp.getRequestList();
            WebPlotResult resultAry[] = VisServerOps.createPlotGroup(reqList,key);

            return WebPlotResultSerializer.createJson(resultAry,key);
        }
    }

    public static class ZoomCmd extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {


            PlotState stateAry[]= sp.getStateAry();
            float level= sp.getRequiredFloat(ServerParams.LEVEL);
            boolean isFull = sp.getOptionalBoolean(ServerParams.FULL_SCREEN, false);

            WebPlotResult result = VisServerOps.setZoomLevel(stateAry, level, isFull);
            return WebPlotResultSerializer.createJson(result);
        }
    }



    public static class FloatAryCmd extends ServerCommandAccess.HttpCommand {

        public void processRequest(HttpServletRequest req, HttpServletResponse res, SrvParam sp) throws Exception {

            PlotState state= sp.getState();
            Band band = Band.parse(sp.getRequired(ServerParams.BAND));
            float [] float1D= VisServerOps.getFloatDataArray(state,band);
            res.setContentType("application/octet-stream");


//            ServletOutputStream out = res.getOutputStream();
//            DataOutputStream dos= new DataOutputStream(new BufferedOutputStream(out, (int)FileUtil.MEG));
//            int len= float1D.length;
//            for(int i=0; (i<len); i++) dos.writeFloat(float1D[i]);
////            for(float f: float1D) dos.writeFloat(f);
//
//            dos.close();
//            out.close();


            ByteBuffer byteBuf = ByteBuffer.allocateDirect(float1D.length * Float.BYTES); //4 bytes per float
            byteBuf.order(ByteOrder.nativeOrder());
            byteBuf.order(ByteOrder.LITTLE_ENDIAN);
            FloatBuffer buffer = byteBuf.asFloatBuffer();
            buffer.put(float1D);
            buffer.position(0);
            WritableByteChannel chan= Channels.newChannel(res.getOutputStream());
            chan.write(byteBuf);
            chan.close();



        }
    }

    public static class ByteAryCmd extends ServerCommandAccess.HttpCommand {

        public void processRequest(HttpServletRequest req, HttpServletResponse res, SrvParam sp) throws Exception {

            PlotState state= sp.getState();
            boolean mask= sp.getOptionalBoolean(ServerParams.MASK_DATA,false);
            int maskBits= sp.getOptionalInt(ServerParams.MASK_BITS,0);
            int tileSize = sp.getRequiredInt(ServerParams.TILE_SIZE);
            byte [] byte1D= VisServerOps.getByteStretchArray(state,tileSize,mask,maskBits);
            res.setContentType("application/octet-stream");

            ByteBuffer byteBuf = ByteBuffer.wrap(byte1D);
            byteBuf.position(0);
            WritableByteChannel chan= Channels.newChannel(res.getOutputStream());
            chan.write(byteBuf);
            chan.close();
        }
    }

    public static class ExtractionCmd extends ServerCommandAccess.HttpCommand {
        public void processRequest(HttpServletRequest req, HttpServletResponse res, SrvParam sp) throws Exception {

            PlotState state= sp.getState();
            String exType= sp.getRequired(ServerParams.EXTRACTION_TYPE);
            boolean useFloat = sp.getOptionalInt(ServerParams.EXTRACTION_FLOAT_SIZE,64)==32;
            int ptSize= sp.getOptionalInt(ServerParams.POINT_SIZE,1);
            boolean relatedHDUs= sp.getOptionalBoolean(ServerParams.RELATED_HDUS, false);
            int hduNum= sp.getRequiredInt(ServerParams.HDU_NUM);

            int plane;
            ImagePt pt, pt2;
            ImagePt [] ptAry;
            double [] extractAry;

            switch (exType) {
                case "z-axis":
                    pt= sp.getRequiredImagePt(ServerParams.PT);
                    extractAry= VisServerOps.getZAxisAry(state,pt,hduNum,ptSize,relatedHDUs);
                    break;
                case "line":
                    pt=sp.getRequiredImagePt(ServerParams.PT);
                    pt2= sp.getRequiredImagePt(ServerParams.PT2);
                    plane= sp.getRequiredInt(ServerParams.PLANE);
                    extractAry= VisServerOps.getLineDataAry(state,pt,pt2,plane,hduNum,ptSize);
                    break;
                case "points":
                    ptAry= sp.getRequiredImagePtAry(ServerParams.PTARY);
                    plane= sp.getRequiredInt(ServerParams.PLANE);
                    extractAry= VisServerOps.getPointDataAry(state,ptAry,plane,hduNum,ptSize);
                    break;
                default:
                    throw new IllegalArgumentException(ServerParams.EXTRACTION_TYPE+" is not supported");
            }



            res.setContentType("application/octet-stream");
            ByteBuffer byteBuf = useFloat ?
                    ByteBuffer.allocateDirect(extractAry.length * Float.BYTES) : //4 bytes per float
                    ByteBuffer.allocateDirect(extractAry.length * Double.BYTES); //8 bytes per float
            byteBuf.order(ByteOrder.nativeOrder());
            byteBuf.order(ByteOrder.LITTLE_ENDIAN);
            if (useFloat) {
                float[] floatExtractAry= new float[extractAry.length];
                for(int i=0;(i<floatExtractAry.length);i++) floatExtractAry[i]= (float)extractAry[i];
                byteBuf.asFloatBuffer().put(floatExtractAry);
            }
            else {
                byteBuf.asDoubleBuffer().put(extractAry);;
            }
            byteBuf.position(0);
            WritableByteChannel chan= Channels.newChannel(res.getOutputStream());
            chan.write(byteBuf);
            chan.close();
        }
    }



    public static class StretchCmd extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {

            PlotState state= sp.getState();
            List<StretchData> list = new ArrayList<>(3);

            StretchData sd;
            sd= VisJsonSerializer.deserializeStretchDataFromString(
                    sp.getOptional(ServerParams.STRETCH_DATA + "0"));
            if (sd != null) list.add(sd);
            sd= VisJsonSerializer.deserializeStretchDataFromString(
                    sp.getOptional(ServerParams.STRETCH_DATA + "1"));
            if (sd != null) list.add(sd);
            sd= VisJsonSerializer.deserializeStretchDataFromString(
                    sp.getOptional(ServerParams.STRETCH_DATA + "2"));
            if (sd != null) list.add(sd);

            StretchData sdAry[] = list.toArray(new StretchData[list.size()]);


            if (sdAry.length == 0) {
                throw new IllegalArgumentException("missing parameters");
            }

            WebPlotResult result = VisServerOps.recomputeStretch(state, sdAry);
            return WebPlotResultSerializer.createJson(result);
        }
    }

    public static class ChangeColor extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            
            PlotState state= sp.getState();
            int idx= sp.getRequiredInt(ServerParams.COLOR_IDX);
            WebPlotResult result = VisServerOps.changeColor(state, idx);
            return WebPlotResultSerializer.createJson(result);
        }
    }

    public static class Crop extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            
            ImagePt pt1= sp.getRequiredImagePt(ServerParams.PT1);
            ImagePt pt2= sp.getRequiredImagePt(ServerParams.PT2);
            boolean cropMultiAll= sp.getOptionalBoolean(ServerParams.CRO_MULTI_ALL, false);
            if (sp.contains(ServerParams.STATE)) {
                PlotState state= sp.getState();
                WebPlotResult result = VisServerOps.crop(state, pt1, pt2, cropMultiAll);
                return WebPlotResultSerializer.createJson(result);
            }
            else {
                PlotState stateAry[]= sp.getStateAry();
                WebPlotResult result = VisServerOps.crop(stateAry, pt1, pt2, cropMultiAll);
                return WebPlotResultSerializer.createJson(result);
            }
        }
    }

    public static class AreaStat extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            
            PlotState state= sp.getState();
            ImagePt pt1= sp.getRequiredImagePt(ServerParams.PT1);
            ImagePt pt2= sp.getRequiredImagePt(ServerParams.PT2);
            ImagePt pt3= sp.getRequiredImagePt(ServerParams.PT3);
            ImagePt pt4= sp.getRequiredImagePt(ServerParams.PT4);
            String  shape = sp.getOptional(ServerParams.GEOSHAPE);
            String  rotation = sp.getOptional(ServerParams.ROTATION);
            if (shape == null) shape = "rect";
            if (rotation == null) rotation = "0";  // image rotation angle

            double rAngle = Math.toRadians(Double.parseDouble(rotation));

            WebPlotResult result = VisServerOps.getAreaStatistics(state, pt1, pt2, pt3, pt4, shape, rAngle);
            return WebPlotResultSerializer.createJson(result);
        }
    }




    public static class ColorHistogram extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            
            PlotState state= sp.getState();
            Band band= Band.parse(sp.getRequired(ServerParams.BAND));
            WebPlotResult result = VisServerOps.getColorHistogram(state, band);

            return WebPlotResultSerializer.createJson(result);
        }
    }


    public static class DS9Region extends ServCommand {
        private static final String footprintKey = "${footprintDef}";
        private static final String footprintFileKey="${footprintFile}";

        public String doCommand(SrvParam sp) throws IllegalArgumentException, IOException {
            String fileKey = sp.getRequired(ServerParams.FILE_KEY);
            WebPlotResult result;

            if (fileKey.contains(footprintKey)) {
                result = VisServerOps.getFootprintRegion(fileKey.substring(footprintKey.length()));
            } else if (fileKey.contains(footprintFileKey)) {
                result = VisServerOps.getRelocatableRegions(fileKey.substring(footprintFileKey.length()));
            } else {
                result = VisServerOps.getDS9Region(fileKey);
            }
            return WebPlotResultSerializer.createJson(result);
        }
    }

    public static class SaveDS9Region extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            String data = sp.getRequired(ServerParams.REGION_DATA);
            WebPlotResult result= VisServerOps.saveDS9RegionFile(data);
            return WebPlotResultSerializer.createJson(result);
        }
    }

    public static class GetMasterImageData extends ServCommand {

        public String doCommand(SrvParam sp) throws IllegalArgumentException {
            String imageSources = sp.getRequired(ServerParams.IMAGE_SOURCES);
            String sortOrder = sp.getOptional(ServerParams.SORT_ORDER);
            String imageSourcesAry[] = imageSources.split(",");
            String sortOrderAry[]= (sortOrder!=null) ? sortOrder.split(",") : null;
            JSONArray result= ImageMasterData.getJson(imageSourcesAry, sortOrderAry);
            JSONObject obj= new JSONObject();
            if (result!=null) {
                obj.put("success", true);
                obj.put("data", result);
            }
            else {
                obj.put("success", false);
                obj.put("data", null);
                obj.put("message", "Could not generate data");
            }

            return obj.toJSONString();
        }
    }


}

