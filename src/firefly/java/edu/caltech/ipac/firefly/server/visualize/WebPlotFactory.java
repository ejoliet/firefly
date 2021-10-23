/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.visualize;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.data.RelatedData;
import edu.caltech.ipac.firefly.server.Counters;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.visualize.Band;
import edu.caltech.ipac.firefly.visualize.BandState;
import edu.caltech.ipac.firefly.visualize.PlotImages;
import edu.caltech.ipac.firefly.visualize.PlotState;
import edu.caltech.ipac.firefly.visualize.WebFitsData;
import edu.caltech.ipac.firefly.visualize.WebPlotHeaderInitializer;
import edu.caltech.ipac.firefly.visualize.WebPlotInitializer;
import edu.caltech.ipac.firefly.visualize.WebPlotRequest;
import edu.caltech.ipac.firefly.visualize.ZoomType;
import edu.caltech.ipac.util.Assert;
import edu.caltech.ipac.util.ComparisonUtil;
import edu.caltech.ipac.util.FileUtil;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.util.UTCTimeUtil;
import edu.caltech.ipac.util.download.FailedRequestException;
import edu.caltech.ipac.visualize.plot.ActiveFitsReadGroup;
import edu.caltech.ipac.visualize.plot.CoordinateSys;
import edu.caltech.ipac.visualize.plot.ImagePlot;
import edu.caltech.ipac.visualize.plot.plotdata.FitsRead;
import edu.caltech.ipac.visualize.plot.plotdata.GeomException;
import nom.tam.fits.FitsException;
import nom.tam.fits.Header;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static edu.caltech.ipac.firefly.visualize.Band.BLUE;
import static edu.caltech.ipac.firefly.visualize.Band.GREEN;
import static edu.caltech.ipac.firefly.visualize.Band.NO_BAND;
import static edu.caltech.ipac.firefly.visualize.Band.RED;

/**
 * @author Trey Roby
 */
public class WebPlotFactory {

    private static final Logger.LoggerImpl _log = Logger.getLogger();

    static {
        VisContext.init();
    }

    public static WebPlotFactoryRet createNew(WebPlotRequest rRequest,
                                                 WebPlotRequest gRequest,
                                                 WebPlotRequest bRequest) throws FailedRequestException, GeomException {

        LinkedHashMap<Band, WebPlotRequest> rMap = new LinkedHashMap<>();

        if (rRequest != null) rMap.put(RED, rRequest);
        if (gRequest != null) rMap.put(GREEN, gRequest);
        if (bRequest != null) rMap.put(BLUE, bRequest);

        return create(rMap, PlotState.MultiImageAction.USE_FIRST, null, true);
    }

    public static WebPlotFactoryRet createNew(WebPlotRequest request) throws FailedRequestException, GeomException {
        Map<Band, WebPlotRequest> requestMap = new LinkedHashMap<>(2);
        requestMap.put(NO_BAND, request);
        PlotState.MultiImageAction multiAction= PlotState.MultiImageAction.USE_ALL;
        if (request.containsParam(WebPlotRequest.MULTI_IMAGE_IDX)) {
            multiAction= PlotState.MultiImageAction.USE_IDX;
        } else if (request.containsParam(WebPlotRequest.MULTI_IMAGE_EXTS)) {
            multiAction = PlotState.MultiImageAction.USE_EXTS;
        }
        return create(requestMap, multiAction, null, false);
    }

    public static WebPlotFactoryRet recreate(PlotState state) throws FailedRequestException, GeomException {
        Map<Band, WebPlotRequest> requestMap = new LinkedHashMap<Band, WebPlotRequest>(5);
        for (Band band : state.getBands()) requestMap.put(band, state.getWebPlotRequest(band));
        for(WebPlotRequest req : requestMap.values()) {
            req.setZoomType(ZoomType.LEVEL);
            req.setInitialZoomLevel(state.getZoomLevel());
        }
        WebPlotFactoryRet retval = create(requestMap, null, state, state.isThreeColor());
        Assert.argTst(retval.wpInit.length == 1, "in this case you should never have more than one result");
        return retval;
    }

//======================================================================
//------------------ Private / Protected Methods -----------------------
//======================================================================

    private static void sendMsg(int i, ImagePlotInfo[] pInfo) {
        boolean notify= pInfo.length<5 || i % ((pInfo.length/10)+1)==0 || i==pInfo.length-1;
        if (!notify) return;
        ImagePlotInfo pi = pInfo[i];
        if (pInfo.length>3) {
            if (i==pInfo.length-1) {
                PlotServUtils.updatePlotCreateProgress(pi.getState().getWebPlotRequest(),
                        ProgressStat.PType.CREATING,
                        PlotServUtils.PROCESSING_COMPLETED_MSG);
            }
            else {
                PlotServUtils.updatePlotCreateProgress(pi.getState().getWebPlotRequest(), ProgressStat.PType.CREATING,
                        PlotServUtils.PROCESSING_MSG+": "+ (i+1)+" of "+pInfo.length);
            }
        }
        else {
            PlotServUtils.updatePlotCreateProgress(pi.getState().getWebPlotRequest(),ProgressStat.PType.CREATING,
                    PlotServUtils.PROCESSING_MSG);
        }
    }


    private static WebPlotFactoryRet create(Map<Band, WebPlotRequest> requestMap,
                                            PlotState.MultiImageAction multiAction,
                                            PlotState state,
                                               boolean threeColor) throws FailedRequestException {


        long start = System.currentTimeMillis();
        WebPlotRequest saveRequest = requestMap.values().iterator().next();
        WebPlotInitializer[] wpInit;
        WebPlotHeaderInitializer wpHeader= null;
        if (requestMap.size() == 0) {
            throw new FailedRequestException("Could not create plot", "All WebPlotRequest are null");
        }


        try {

            ImagePlotBuilder.Results allPlots= ImagePlotBuilder.build(requestMap, multiAction, state, threeColor);

            // ------------ Iterate through results, Prepare the return objects, including PlotState if it is null
            ImagePlotInfo[] pInfo= allPlots.getPlotInfoAry();
            wpInit = new WebPlotInitializer[pInfo.length];
            PlotState lastState= null;
            for (int i = 0; (i < pInfo.length); i++) {
                ImagePlotInfo pi = pInfo[i];
                if (i==0) saveRequest= pi.getState().getWebPlotRequest();
                sendMsg(i,pInfo);
                for (Map.Entry<Band, ModFileWriter> entry : pi.getFileWriterMap().entrySet()) {
                    ModFileWriter mfw = entry.getValue();
                    if (mfw != null) {
                        if (mfw.getCreatesOnlyOneImage()) pi.getState().setImageIdx(0, entry.getKey());
                        mfw.writeFile(pi.getState());
                    }
                }

                if (i==0 && !threeColor) {
                    PlotState s= pInfo[i].getState();

                    FitsRead[] frAry= pInfo[0].getFrGroup().getFitsReadAry();
                    FileInfo fi= pInfo[0].getFileInfo();
                    Map<String,String> attributes= null;
                    if (fi!=null) {
                        attributes= fi.getAttributeMap();
                        attributes.remove(FileInfo.INTERNAL_NAME);
                    }
                    Header[] zeroHeaderAry= new Header[frAry.length];
                    for(int k=0; k<zeroHeaderAry.length; k++) {
                        zeroHeaderAry[k]= frAry[k]!=null ? frAry[k].getZeroHeader() : null;
                    }
                    wpHeader= new WebPlotHeaderInitializer(s.getOriginalFitsFileStr(NO_BAND),
                            s.getWorkingFitsFileStr(NO_BAND), s.getUploadFileName(NO_BAND),
                            s.getRangeValues(), pInfo[i].getDataDesc(), s.getColorTableId(),
                            s.isMultiImageFile(), s.getMultiImageAction(),
                            false, s.getPrimaryRequest(),zeroHeaderAry, attributes);
                }
                wpInit[i] = makePlotResults(pi, false, allPlots.getZoomChoice(), !threeColor,
                        !fileEqual(pi.getState(),lastState) );
                lastState= pi.getState();
            }
            long elapse = System.currentTimeMillis() - start;
            logSuccess(pInfo[0].getState(), elapse, allPlots.getFindElapse(), allPlots.getReadElapse(), false, null, true);
        } catch (FailedRequestException e) {
            updateProgressIsFailure(saveRequest);
            throw e;
        } catch (FitsException e) {
            updateProgressIsFailure(saveRequest);
            throw new FailedRequestException(e.getMessage(), e.getMessage(), e);
        } catch (Exception e) {
            updateProgressIsFailure(saveRequest);
            throw new FailedRequestException("Could not create plot", e.getMessage(), e);
        }
        return new WebPlotFactoryRet(wpInit,wpHeader);
    }

    private static boolean fileEqual(PlotState s1, PlotState s2) {
        if (s1==null || s2==null) return false;
        boolean equal= s1.getBands().length==s2.getBands().length;
        if (!equal) return false;
        for(Band b : s1.getBands()) {
            if (!ComparisonUtil.equals(s1.getWorkingFitsFileStr(b), s2.getWorkingFitsFileStr(b))) return false;
        }
        return true;

    }

    private static void updateProgressIsFailure(WebPlotRequest wpr) {
        if (wpr!=null) PlotServUtils.updatePlotCreateProgress(wpr, ProgressStat.PType.FAIL, "Failed");
    }


    private static WebPlotInitializer makePlotResults(ImagePlotInfo pInfo, boolean makeFiles,
                                                      ZoomChoice zoomChoice, boolean clearHeaderData,
                                                      boolean clearCachedHDU)
                                               throws FitsException, IOException {
        PlotState state = pInfo.getState();

        if (clearCachedHDU) {
            for(Band b : state.getBands()) { //clearing out hdu cuts fits memory usage in half
                File f= ServerContext.convertToFile(state.getWorkingFitsFileStr(b));
                if (f!=null) FitsCacher.clearCachedHDU(f);
            }
        }

        boolean fullScreen= zoomChoice.getZoomType() == ZoomType.FULL_SCREEN;
        long w= pInfo.getPlot().getImageDataWidth();
        long h= pInfo.getPlot().getImageDataHeight();
        PlotImages images = w*h > 10L*FileUtil.MEG ?
                createImages(state, pInfo.getPlot(), pInfo.getFrGroup(),makeFiles, fullScreen) : null;

        WebPlotInitializer wpInit = makeWebPlotInitializer(state, images, pInfo, clearHeaderData);

        CtxControl.initPlotCtx(state, pInfo.getPlot(), pInfo.getFrGroup(), images);

        return wpInit;
    }

    private static WebPlotInitializer makeWebPlotInitializer(PlotState state, PlotImages images,
                                                             ImagePlotInfo pInfo,
                                                             boolean clearHeaderData) {
        // need a WebFits Data each band: normal is 1, 3 color is three
        WebFitsData wfDataAry[] = new WebFitsData[3];

        for (Map.Entry<Band, WebFitsData> entry : pInfo.getWebFitsDataMap().entrySet()) {
            wfDataAry[entry.getKey().getIdx()] = entry.getValue();
        }



        ImagePlot plot = pInfo.getPlot();
        FitsRead[] frAry= pInfo.getFrGroup().getFitsReadAry();
        Header[] headerAry= new Header[frAry.length];
        Header[] zeroHeaderAry= new Header[frAry.length];
        for(int i=0; i<headerAry.length; i++) {
            headerAry[i]= frAry[i]!=null ? frAry[i].getHeader() : null;
            zeroHeaderAry[i]= frAry[i]!=null ? frAry[i].getZeroHeader() : null;
        }
        int dataWidth= plot.getImageDataWidth();
        int dataHeight= plot.getImageDataHeight();
        CoordinateSys imageCoordSys= plot.getCoordinatesOfPlot();



        List<RelatedData> rdList= pInfo.getRelatedData();
        int noBandIdx= NO_BAND.getIdx();
        if (!state.isThreeColor()) {
            if (frAry[noBandIdx].isCube()) {
                int cubePlane = frAry[noBandIdx].getPlaneNumber();
                state.setCubePlaneNumber(cubePlane,NO_BAND);
                if (cubePlane>0) {  // have a cube
                    headerAry = null;
                    rdList = null;
                    dataWidth = -1;
                    dataHeight = -1;
                    imageCoordSys = null;
                }
            }
        }

        if (clearHeaderData) {
            state= state.makeCopy();
            BandState bsAry[]= state.getBandStateAry();
            state.setMultiImageAction(PlotState.MultiImageAction.GUESS);
            state.setColorTableId(0);
            for(int i=0; i<3; i++) {
                if (bsAry[i]!=null) {
                    bsAry[i].setWebPlotRequest(null);
                    bsAry[i].setUploadedFileName(null);
                    bsAry[i].setWorkingFitsFileStr(null);
                    bsAry[i].setOriginalFitsFileStr(null);
                    bsAry[i].setRangeValues(null);
                    bsAry[i].setMultiImageFile(false);
                }
            }
            zeroHeaderAry= null;
        }


        return new WebPlotInitializer(state,
                                      images,
                                      imageCoordSys,
                                      headerAry,
                                      zeroHeaderAry,
                                      dataWidth, dataHeight,
                                      wfDataAry,
                                      plot.getPlotDesc(),
                                      clearHeaderData ? null : pInfo.getDataDesc(),
                                      rdList);
    }


    private static PlotImages createImages(PlotState state,
                                           ImagePlot plot,
                                           ActiveFitsReadGroup frGroup,
                                           boolean makeFiles,
                                           boolean fullScreen) throws IOException {
        String base = PlotServUtils.makeTileBase(state);

        return PlotServUtils.writeImageTiles(ServerContext.getVisSessionDir(),
                                             base, plot, frGroup, fullScreen,
                                             makeFiles ? 2 : 0);

    }

    private static void logSuccess(PlotState state,
                                   long elapse,
                                   long findElapse,
                                   long readElapse,
                                   boolean bandAdded,
                                   Band newBand,
                                   boolean newPlot) {
        String threeDesc = state.isThreeColor() ? "three color " : "";
        String majType = newPlot ? threeDesc + "create plot  " : threeDesc + "recreate plot";
        String minType = "file   ";
        String time3String = bandAdded ? ", Insert-" : ", Read-";
        long totSize = 0;

        List<String> out = new ArrayList<>(8);
        String more = String.format("%s%9s%s%9s",
                                    ", Find-", UTCTimeUtil.getHMSFromMills(findElapse),
                                    time3String, UTCTimeUtil.getHMSFromMills(readElapse));
        out.add(majType + " - " + minType + ": Total: " + UTCTimeUtil.getHMSFromMills(elapse) + more +
                ", Ctx:"+state.getContextString());

        if (bandAdded) {
            String bStr = newBand.toString() + " - ";
            File f = PlotStateUtil.getWorkingFitsFile(state, newBand);
            out.add("band: " + newBand + " added");
            if (!PlotServUtils.isBlank(state, newBand)) {
                String sizeStr= FileUtil.getSizeAsString(f.length());
                out.add(bStr + "filename "+"("+sizeStr+ ")" +": " + f.getPath());
                totSize = f.length();
            } else {
                out.add(bStr + "Blank Image");
            }
        } else {
            for (Band band : state.getBands()) {
                String bStr = state.isThreeColor() ? StringUtils.pad(5, band.toString()) + " - " : "";
                File f = PlotStateUtil.getWorkingFitsFile(state, band);
                if (!PlotServUtils.isBlank(state, band)) {
                    if (f!=null) {
                        String sizeStr= FileUtil.getSizeAsString(f.length());
                        out.add(bStr + "filename "+"("+sizeStr+ ")" +": " + f.getPath());
                        totSize += f.length();
                    }
                } else {
                    out.add(bStr + "Blank Image");
                }
            }
        }
        out.add("PlotState Summary: " + state.toPrettyString());

        String statDetails = String.format("%6s%s", FileUtil.getSizeAsString(totSize), more);
        _log.info(out.toArray(new String[out.size()]));
        PlotServUtils.statsLog("create", "total-MB", (double) totSize / StringUtils.MEG, "Details", statDetails);
        Counters.getInstance().incrementKB(Counters.Category.Visualization, "Total Read", totSize/ StringUtils.K);
    }


    public static class WebPlotFactoryRet {
        private WebPlotInitializer[] wpInit;
        private WebPlotHeaderInitializer wpHeader;

        public WebPlotFactoryRet(WebPlotInitializer[] wpInit, WebPlotHeaderInitializer wpHeader) {
            this.wpInit = wpInit;
            this.wpHeader = wpHeader;
        }

        public WebPlotInitializer[] getWpInit() { return wpInit; }

        public WebPlotHeaderInitializer getWpHeader() { return wpHeader; }
    }

}

